## It got out of hand

<div class="photo-grid">
<img src="images/bench-desk-1.jpg" alt="Desk covered in kit, a BBC Micro and a spectrum display" />
<img src="images/bench-beeb-modulator.jpg" alt="Inside a BBC Micro, pointing at the UHF modulator" />
<img src="images/bench-scope-rf.jpg" alt="Oscilloscope showing a modulated signal" />
<img src="images/bench-desk-2.jpg" alt="BBC Micro on the floor under the desk, cables everywhere" />
<img src="images/bench-scope-line.jpg" alt="Oscilloscope showing one video line: sync and colour burst" />
<img src="images/bench-desk-3.jpg" alt="BBC Micro on the desk with a multimeter and test leads" />
</div>

Notes:
So I bought a software defined radio, plugged in the aerial output of a BBC Micro and a games
console, and recorded the actual radio signal. Then I bought an oscilloscope. Then the desk
disappeared.

---

## PALindrome

<div class="scene wide" data-scene="chain"></div>

Notes:
Then I wrote a television. Not a DSP-textbook decoder: a model of a 1980s set. A SAW filter, an
AGC, a sync separator, flywheel oscillators for horizontal and vertical, a PAL decoder with a
delay line and a colour killer, and then a CRT: the beam, the flyback, the phosphors.

---

<!-- .slide: data-background-color="#000" -->

<img src="images/wb3.gif" alt="Wonder Boy III decoded from RF by PALindrome" style="height: 820px" />

Notes:
That's Wonder Boy III, off air, through a television that only exists in software. The first
frames are the set locking on: the vertical hold catches, then the colour killer decides this
really is PAL and the colour fades up. That's how switch-on looked. It's not a bug.
