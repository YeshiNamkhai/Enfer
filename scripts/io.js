'use strict'

/*
function IO (client) {
  this.devices = []
  this.index = -1

  this.controller = null
  this.source = null

  this.install = (host) => {

  }

  this.start = () => {
    this.refresh()
    console.log('IO', 'Starting..')
  }

  this.connect = (source = 'Midi Through', controller = 'LPD8') => {
    this.controller = this.find(controller)
    this.source = this.find(source)

    if (!this.controller) {
      console.warn('IO', 'Could not connect ' + controller)
    } else {
      console.info('IO', 'Connected to controller ' + this.controller.name)
      this.controller.onmidimessage = this.onControl
    }

    if (!this.source) {
      console.warn('IO', 'Could not connect ' + source)
    } else {
      console.info('IO', 'Connected to source ' + this.source.name)
      this.source.onmidimessage = this.onMessage
    }
  }

  this.find = (name) => {
    for (const device of this.devices) {
      if (device.name.indexOf(name) < 0) { continue }
      return device
    }
  }

  this.refresh = () => {
    if (!navigator.requestMIDIAccess) { return }
    navigator.requestMIDIAccess().then(this.access, (err) => {
      console.warn('No Midi', err)
    })
  }

  this.list = () => {
    for (const device of this.devices) {
      console.info('IO', device.name)
    }
  }

  this.onControl = (msg) => {
    if (msg.data[0] >= 176 && msg.data[0] < 184) {
      const ch = msg.data[0] - 176
      const knob = msg.data[1] - 1
      const val = msg.data[2]
      client.mixer.tweak(ch, knob, val)
    } else if (msg.data[0] === 144) {
      const pad = msg.data[1]
      const vel = msg.data[2]
      client.rack.play(client.channel, pad, vel)
    }
  }

  this.onMessage = (msg) => {
    if (msg.data[0] >= 144 && msg.data[0] < 160) {
      const ch = msg.data[0] - 144
      const pad = msg.data[1] - 24
      const vel = msg.data[2]
      client.rack.play(ch, pad, vel)
    } else if (msg.data[0] >= 176 && msg.data[0] < 184) {
      const ch = msg.data[0] - 176
      const knob = msg.data[1] - 1
      const vel = msg.data[2]
      client.mixer.tweak(ch, knob, vel)
    }
  }

  this.access = (midiAccess) => {
    const inputs = midiAccess.inputs.values()
    this.devices = []
    for (let i = inputs.next(); i && !i.done; i = inputs.next()) {
      this.devices.push(i.value)
    }
    this.connect()
  }
}
*/

function IO (client) {
  this.midiSources = [] // Tutti i device MIDI IN disponibili
  this.index1 = -1      // Indice per la Sorgente 1
  this.index2 = -1      // Indice per la Sorgente 2

  this.source1 = null   // Device collegato a >> 1
  this.source2 = null   // Device collegato a >> 2
  
  this.customMap = {} // Formato: { "cc_number": { ch: 0, knob: 0 } }
  this.isLearning = false

  // Container feedback visivo stile Orca
  this.el = document.createElement('div')
  this.el.style = 'position:absolute;bottom:20px;right:20px;display:flex;flex-direction:column;align-items:flex-end;gap:2px;pointer-events:none;font-family:monospace;font-size:12px;z-index:1000;'
  
  this.labelLearn = document.createElement('span')
  this.labelLearn.style = 'color:#000;background:#72dec2;padding:2px 8px;border-radius:2px;display:none;font-weight:bold;margin-bottom:4px;'
  
  this.label1 = document.createElement('span')
  this.label1.style = 'color:white;background:rgba(0,0,0,0.6);padding:2px 8px;border-radius:2px;'
  
  this.label2 = document.createElement('span')
  this.label2.style = 'color:white;background:rgba(0,0,0,0.6);padding:2px 8px;border-radius:2px;'

  this.install = (host) => {
    this.el.appendChild(this.labelLearn) // Aggiunta in cima alla colonna
    this.el.appendChild(this.label1)
    this.el.appendChild(this.label2)
    host.appendChild(this.el)
  }

  this.startLearn = () => {
    const activeEl = document.activeElement
    
    // Se l'elemento attivo non è un input range, cerchiamo di capire se abbiamo cliccato
    // un knob di recente. Altrimenti cerchiamo lo slider.
    let targetIndex = -1
    
    if (activeEl && activeEl.tagName === 'INPUT') {
      // Usiamo il conteggio fisico che è il più affidabile in questo caso
      const allSliders = Array.from(document.querySelectorAll('input[type="range"]'))
      targetIndex = allSliders.indexOf(activeEl)
    }

    // Se premiamo Enter e il focus è perso, non procedere con lo 0 "a caso"
    if (targetIndex === -1) {
      console.warn("Nessun knob selezionato. Clicca su uno slider prima di premere Enter.")
      return 
    }

    this.isLearning = true
    this.learningTarget = targetIndex
    
    // Recupero nome
    const label = activeEl.parentElement ? activeEl.parentElement.querySelector('.label') : null
    const targetName = label ? label.textContent : "PARAM"

    this.labelLearn.textContent = `LEARN: ${targetName.toUpperCase()}`
    this.labelLearn.style.display = 'block'
    this.labelLearn.style.background = '#72dec2' 
    this.labelLearn.style.color = 'black'
  }

  this.start = () => {
    this.refresh()
    console.log('IO', 'Starting..')
  }

  this.connect = () => {
    const d = this.midiSources

    // 1. Reset totale per zittire i device non selezionati
    for (let i = 0; i < d.length; i++) {
      d[i].onmidimessage = null
    }

    if (d.length === 0) {
      this.label1.textContent = `<< 1 Offline`
      this.label2.textContent = `<< 2 Offline`
      return
    }

    // 2. Inizializzazione indici (garantisce diversità se possibile)
    if (this.index1 < 0) { this.index1 = 0 }
    if (this.index2 < 0) { this.index2 = (d.length > 1) ? 1 : 0 }
    
    // Forza la diversità: se sono uguali e c'è scelta, sposta lo Slot 2
    if (this.index1 === this.index2 && d.length > 1) {
      this.index2 = (this.index1 + 1) % d.length
    }

    this.source1 = d[this.index1]
    this.source2 = d[this.index2]

    // 3. Assegnazione Slot 1 (Mixer/Pads)
    this.label1.textContent = `<, 1 ${this.source1.name}`
    this.source1.onmidimessage = this.onControl

    // 4. Assegnazione Slot 2 (Note/Rack)
    if (this.source2 && this.index2 !== this.index1) {
      this.label2.textContent = `<. 2 ${this.source2.name}`
      this.source2.onmidimessage = this.onMessage
    } else {
      // Caso limite: un solo device totale
      this.label2.textContent = `<. 2 (Busy)` 
    }
  }

  this.next1 = () => {
    if (this.midiSources.length < 2) { return }
    let nextIndex = (this.index1 + 1) % this.midiSources.length
    
    // Salta il device già occupato dallo slot 2
    if (nextIndex === this.index2) {
      nextIndex = (nextIndex + 1) % this.midiSources.length
    }
    
    this.index1 = nextIndex
    this.connect()
  }

  this.next2 = () => {
    if (this.midiSources.length < 2) { return }
    let nextIndex = (this.index2 + 1) % this.midiSources.length
    
    // Salta il device già occupato dallo slot 1
    if (nextIndex === this.index1) {
      nextIndex = (nextIndex + 1) % this.midiSources.length
    }
    
    this.index2 = nextIndex
    this.connect()
  }

  this.find = (name) => {
    for (const device of this.devices) {
      if (device.name.indexOf(name) < 0) { continue }
      return device
    }
  }

  this.refresh = () => {
    if (!navigator.requestMIDIAccess) { return }
    navigator.requestMIDIAccess().then(this.access, (err) => {
      console.warn('No Midi', err)
    })
  }

  this.list = () => {
    for (const device of this.devices) {
      console.info('IO', device.name)
    }
  }

  this.onControl = (msg) => {
    const status = msg.data[0]
    const cc = msg.data[1]
    const val = msg.data[2]

    // 1. TASTIERA (Sempre funzionante)
    if (status === 144 || status === 145) {
      if (client.rack && client.rack.play) { client.rack.play(client.channel, cc % 16, val) }
      return 
    }

    // 2. GESTIONE MIDI CC (Knobs)
    if (status >= 176 && status < 184) {
      
      // Se premi ENTER e muovi il knob...
      if (this.isLearning) {
        this.customMap[cc] = { knob: this.learningTarget }
        this.isLearning = false
        this.labelLearn.style.display = 'none'
        console.log(`MAPPATO: CC ${cc} -> Knob ${this.learningTarget}`)
        return
      }

      // ESECUZIONE
      if (this.customMap && this.customMap[cc] !== undefined) {
        const target = this.customMap[cc].knob
        
        // Cerchiamo l'array corretto dei knob
        // In Enfer spesso i knob sono in client.rack.knobs
        const knobs = client.rack.knobs
        
        if (knobs && knobs[target]) {
          const val = msg.data[2]
          
          // 1. Applica il valore allo slider (0-127 -> 0-100 interni)
          knobs[target].tweak(val)
          
          // 2. FORZA l'aggiornamento del cerchio SVG e della funzione sonora
          // Se non chiami update(), la rotella non gira e il suono non cambia
          if (typeof knobs[target].update === 'function') {
            knobs[target].update()
          }
          
          console.log(`Eseguito: ${knobs[target].label.textContent} impostato a ${val}`)
        } else {
          // Se non lo trova nel rack, lo cerchiamo nel mixer (fallback)
          console.warn(`Mappato su ${target}, ma non trovo il knob in client.rack.knobs. Verifico mixer...`)
          if (client.mixer && client.mixer.tweak) {
            client.mixer.tweak(client.channel, target, val)
          }
        }
      }
    }
  }
  
  this.onMessage = (msg) => {
    if (msg.data[0] >= 144 && msg.data[0] < 160) {
      const ch = msg.data[0] - 144
      const pad = msg.data[1] - 24
      const vel = msg.data[2]
      client.rack.play(ch, pad, vel)
    } else if (msg.data[0] >= 176 && msg.data[0] < 184) {
      const ch = msg.data[0] - 176
      const knob = msg.data[1] - 1
      const vel = msg.data[2]
      client.mixer.tweak(ch, knob, vel)
    }
  }

  this.access = (midiAccess) => {
    const ins = midiAccess.inputs.values()
    this.midiSources = []
    for (let i = ins.next(); i && !i.done; i = ins.next()) {
      this.midiSources.push(i.value)
    }
    this.connect()
  }
}

