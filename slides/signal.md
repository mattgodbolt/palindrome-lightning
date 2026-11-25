## The signal

<div class="scene wide" data-scene="scan" data-viewbox="0 0 1600 880"></div>

Notes:
The signal is just a voltage. Higher is brighter: the beam sweeps left to right and the voltage
sets how bright each bit of the line is. At the end of the line the voltage dips below black:
that's horizontal sync, and it means "fly back to the left and start the next line". Every 64
microseconds. Do that 312 and a half times, then a burst of long pulses, vertical sync, sends the
beam back to the top. Fifty times a second. (If there's time: the half line is the interlace
trick, two fields of 312 and a half make one 625-line frame. There won't be time.)
