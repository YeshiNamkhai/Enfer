'use strict'

/* global Acels */
/* global Theme */
/* global Rack */
/* global Mixer */
/* global IO */

function Client () {
  this.el = document.createElement('div')

  this.acels = new Acels(this)
  this.theme = new Theme(this)

  this.io = new IO(this)
  this.rack = new Rack(this)
  this.mixer = new Mixer(this)

  this.channel = 0

  this.install = (host = document.body) => {
    this.theme.install(host)

    this.theme.default = { background: '#000000', f_high: '#ffffff', f_med: '#777777', f_low: '#444444', f_inv: '#000000', b_high: '#eeeeee', b_med: '#72dec2', b_low: '#444444', b_inv: '#ffb545' }

    host.appendChild(this.el)
    this.acels.set('Play', 'Test Midi', 'Z', () => { this.rack.play(this.channel, 0) })
    this.acels.set('Play', 'Test Midi', 'X', () => { this.rack.play(this.channel, 1) })
    this.acels.set('Play', 'Test Midi', 'C', () => { this.rack.play(this.channel, 2) })
    this.acels.set('Play', 'Test Midi', 'V', () => { this.rack.play(this.channel, 3) })
    this.acels.set('Play', 'Test Midi', 'S', () => { this.rack.play(this.channel, 4) })
    this.acels.set('Play', 'Test Midi', 'D', () => { this.rack.play(this.channel, 5) })
    this.acels.set('Play', 'Test Midi', 'F', () => { this.rack.play(this.channel, 6) })
    this.acels.set('Play', 'Test Midi', 'G', () => { this.rack.play(this.channel, 7) })
    this.acels.set('Play', 'Test Midi', 'E', () => { this.rack.play(this.channel, 8) })
    this.acels.set('Play', 'Test Midi', 'R', () => { this.rack.play(this.channel, 9) })
    this.acels.set('Play', 'Test Midi', 'T', () => { this.rack.play(this.channel, 10) })
    this.acels.set('Play', 'Test Midi', 'Y', () => { this.rack.play(this.channel, 11) })
    this.acels.set('Play', 'Test Midi', '4', () => { this.rack.play(this.channel, 12) })
    this.acels.set('Play', 'Test Midi', '5', () => { this.rack.play(this.channel, 13) })
    this.acels.set('Play', 'Test Midi', '6', () => { this.rack.play(this.channel, 14) })
    this.acels.set('Play', 'Test Midi', '7', () => { this.rack.play(this.channel, 15) })

    this.acels.set('Play', 'Next', ']', () => { this.modChannel(1) })
    this.acels.set('Play', 'Prev', '[', () => { this.modChannel(-1) })

    // Scorrimento MIDI IN con virgola (,)
    this.acels.set('Midi', 'Next Input1', ',', () => { this.io.next1() })
    this.acels.set('Midi', 'Next Input1 Ctrl', 'CmdOrCtrl+,', () => { this.io.next1() })

    // Scorrimento MIDI IN con punto (.)
    this.acels.set('Midi', 'Next Input2', '.', () => { this.io.next2() })
    this.acels.set('Midi', 'Next Input2 Ctrl', 'CmdOrCtrl+.', () => { this.io.next2() })

    // MIDI Learn (Shift + -)
    this.acels.set('Midi', 'Midi Learn', 'Enter', () => { this.io.startLearn() })

    this.acels.install(window)
    this.mixer.install(this.el)
    this.rack.install(this.el)
    this.io.install(this.el)
  }

  this.start = (bpm = 120) => {
    console.info('Client', 'Starting..')
    console.info(`${this.acels}`)
    this.mixer.setBpm(bpm)
    this.theme.start()
  }

  this.modChannel = (mod) => {
    const numKits = this.rack.kits.length
    if (numKits === 0) return

    this.channel = (this.channel + mod + numKits) % numKits
    if (this.io && this.io.flash) {
      this.io.flash(this.channel)
    }
    console.log('Channel', this.channel)
    
  }

  this.save = () => {
    const state = {
      channel: this.channel,
      // Prendiamo tutti gli slider nell'ordine esatto in cui appaiono nel DOM
      // Proprio come fa il tuo startLearn() con Array.from(querySelectorAll)
      knobs: Array.from(document.querySelectorAll('input[type="range"]')).map(s => s.value),
      midi: this.io.customMap
    }

    localStorage.setItem('enfer_state', JSON.stringify(state))
    console.log("Setup Salvato (Indici DOM)")
  }

  this.load = () => {
    const data = localStorage.getItem('enfer_state')
    if (!data) return

    const state = JSON.parse(data)
    this.channel = state.channel || 0
    this.io.customMap = state.midi || {}

    const allSliders = Array.from(document.querySelectorAll('input[type="range"]'))
    
    if (state.knobs) {
      state.knobs.forEach((val, index) => {
        if (allSliders[index]) {
          allSliders[index].value = val
          // Dobbiamo simulare l'input per triggerare l'aggiornamento audio/grafico
          // Cercando il componente Knob associato tramite il parent
          const event = new Event('input', { bubbles: true })
          if (allSliders[index]) {
              allSliders[index].title = `MIDI CC: ${val}`
          }
          allSliders[index].dispatchEvent(event)
        }
      })
    }
    console.log("Setup Caricato")
  }

  this.refreshMidi = () => {
    if (this.io && typeof this.io.refresh === 'function') {
      this.io.refresh()
      console.log('MIDI Devices refreshed.')
    }
  }
}

