'use strict'

function IO (client) {
  this.midiSources = [] // Tutti i device MIDI IN disponibili
  this.index1 = -1      // Indice per la Sorgente 1
  this.index2 = -1      // Indice per la Sorgente 2

  this.source1 = null   // Device collegato a <, 1
  this.source2 = null   // Device collegato a <. 2
  this.lastClickedSlider = null // Memorizza l'ultimo slider toccato
  
  this.customMap = {} // Formato: { "cc_number": { ch: 0, knob: 0 } }
  this.isLearning = false

  // Container feedback visivo stile Orca
  this.el = document.createElement('div')
  this.el.style = 'position:absolute;bottom:20px;right:20px;display:flex;flex-direction:column;align-items:flex-end;gap:2px;pointer-events:none;font-family:monospace;font-size:12px;z-index:1000;'
  
  this.monitorEl = document.createElement('div')
  this.monitorEl.style = 'position:absolute;top:20px;left:50%;transform:translateX(-50%);display:flex;flex-direction:row;gap:4px;z-index:1000;'
  this.channels = []

  this.labelLearn = document.createElement('span')
  this.labelLearn.style = 'color:#000;background:#72dec2;padding:2px 8px;border-radius:2px;display:none;font-weight:bold;margin-bottom:4px;'
  
  this.label1 = document.createElement('span')
  this.label1.style = 'color:white;background:rgba(0,0,0,0.6);padding:2px 8px;border-radius:2px;'
  
  this.label2 = document.createElement('span')
  this.label2.style = 'color:white;background:rgba(0,0,0,0.6);padding:2px 8px;border-radius:2px;'

  this.install = (host) => {
    for (let i = 0; i < 16; i++) {
      const dot = document.createElement('div')
      // LED leggermente più larghi per un look "strip" orizzontale
      dot.style = 'width:12px;height:4px;background:#444;border-radius:1px;transition:background 0.1s;margin:2px'      
      dot.setAttribute('title', `CH ${i + 1}`)
      this.monitorEl.appendChild(dot)
      this.channels.push(dot)
    }

    host.appendChild(this.monitorEl) // Appeso direttamente al centro in alto
    this.el.appendChild(this.labelLearn) // Aggiunta in cima alla colonna
    this.el.appendChild(this.label1)
    this.el.appendChild(this.label2)
    host.appendChild(this.el)
    // Ascolta i click globali per salvare l'ultimo slider usato
    window.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type === 'range') {
        this.lastClickedSlider = e.target
      }
    })
  }

  this.flash = (ch) => {
    if (this.channels[ch]) {
      this.channels[ch].style.background = '#72dec2'
      setTimeout(() => { this.channels[ch].style.background = '#444' }, 100)
    }
  }
  
  this.startLearn = () => {
    // Usa l'elemento attivo O l'ultimo cliccato se il focus è perso (es. menu)
    const activeEl = (document.activeElement && document.activeElement.tagName === 'INPUT') 
      ? document.activeElement 
      : this.lastClickedSlider
    
    let targetIndex = -1
    
    if (activeEl) {
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

    // 1. Reset totale per zittire i device
    for (let i = 0; i < d.length; i++) {
      d[i].onmidimessage = null
    }

    // --- Gestione Slot 1 ---
    if (this.index1 === -1 || d.length === 0) {
      this.label1.textContent = `<, No Input Device`
      this.source1 = null
    } else {
      this.source1 = d[this.index1]
      this.label1.textContent = `<, ${this.source1.name}`
      this.source1.onmidimessage = this.onControl
    }

    // --- Gestione Slot 2 ---
    if (this.index2 === -1 || d.length === 0) {
      this.label2.textContent = `<. No Input Device`
      this.source2 = null
    } else if (this.index2 === this.index1) {
      // Se puntano allo stesso device e non è "No Input", lo slot 2 resta in attesa
      this.label2.textContent = `<. 2 (Busy)`
      this.source2 = null
    } else {
      this.source2 = d[this.index2]
      this.label2.textContent = `<. ${this.source2.name}`
      this.source2.onmidimessage = this.onMessage
    }
  }

  this.next1 = () => {
    // Il ciclo ora include -1 (No Input)
    // Range: -1 a midiSources.length - 1
    let nextIndex = this.index1 + 1
    if (nextIndex >= this.midiSources.length) {
      nextIndex = -1 // Torna a No Input
    }

    // Salta il device occupato dallo slot 2, a meno che non sia -1
    if (nextIndex !== -1 && nextIndex === this.index2) {
      return this.next1_skip(nextIndex)
    }

    this.index1 = nextIndex
    this.connect()
  }

  this.next1_skip = (current) => {
    let nextIndex = current + 1
    if (nextIndex >= this.midiSources.length) { nextIndex = -1 }
    this.index1 = nextIndex
    this.connect()
  }

  this.next2 = () => {
    let nextIndex = this.index2 + 1
    if (nextIndex >= this.midiSources.length) {
      nextIndex = -1
    }

    if (nextIndex !== -1 && nextIndex === this.index1) {
      return this.next2_skip(nextIndex)
    }

    this.index2 = nextIndex
    this.connect()
  }

  this.next2_skip = (current) => {
    let nextIndex = current + 1
    if (nextIndex >= this.midiSources.length) { nextIndex = -1 }
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

    // Attiva il monitor per il canale corrispondente (0-15)
    const ch = status & 0xF 
    this.flash(ch)

    // 1. GESTIONE NOTE (Omni manda al canale [])
    if (status >= 144 && status <= 159) {
      if (client.rack && client.rack.play) {
        client.rack.play(client.channel, cc % 16, val)
      }
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
        
        const allSliders = Array.from(document.querySelectorAll('input[type="range"]'))
        const targetSlider = allSliders[this.learningTarget]
        if (targetSlider) {
          targetSlider.title = `MIDI CC: ${cc}`
        }
        return
      }

      // ESECUZIONE
      if (this.customMap && this.customMap[cc] !== undefined) {
        const target = this.customMap[cc].knob
        
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
          if (client.mixer && client.mixer.tweak) {
            client.mixer.tweak(client.channel, target, val)
          }
        }
      }
    }
  }
  
  this.onMessage = (msg) => {
    // Attiva il monitor
    const ch = msg.data[0] & 0xF
    this.flash(ch)
    
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

