<!-- .slide: class="todo" -->

## It got out of hand

Photos: the Master System, the SDR, the bench

Notes:
So I bought a software defined radio, plugged in a games console's RF output, and recorded the
actual radio signal.

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
