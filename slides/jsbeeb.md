<!-- .slide: data-qr="https://bbc.xania.org/" data-qr-caption="bbc.xania.org" data-qr-position="top-right" -->

## Why do I care?

<div class="side-by-side">
<figure>
<iframe class="emu" data-src="https://bbc.xania.org/?embed&mute&displayMode=rgb&embedBasic=10MODE2%3AVDU23%2C1%2C0%3B0%3B0%3B0%3B%0A20FORI%3D0TO7%3AREADC%3AVDU24%2CI%2A160%3B0%3BI%2A160%2B159%3B1023%3B%3AGCOL0%2C128%2BC%3ACLG%3ANEXT%0A30VDU26%3AFORR%3D2TO30STEP4%3AC%3D%28R%20DIV4%29MOD8%3ACOLOUR128%2BC%3ACOLOUR7-C%3APRINTTAB%284%2CR%29%22%20PAL%20%20TELLY%20%22%3B%3ANEXT%0A40REPEATUNTILFALSE%0A50DATA7%2C3%2C6%2C2%2C5%2C1%2C4%2C0%0A"></iframe>
<figcaption>Too nice</figcaption>
</figure>
<figure>
<iframe class="emu" data-src="https://bbc.xania.org/?embed&mute&displayMode=pal&embedBasic=10MODE2%3AVDU23%2C1%2C0%3B0%3B0%3B0%3B%0A20FORI%3D0TO7%3AREADC%3AVDU24%2CI%2A160%3B0%3BI%2A160%2B159%3B1023%3B%3AGCOL0%2C128%2BC%3ACLG%3ANEXT%0A30VDU26%3AFORR%3D2TO30STEP4%3AC%3D%28R%20DIV4%29MOD8%3ACOLOUR128%2BC%3ACOLOUR7-C%3APRINTTAB%284%2CR%29%22%20PAL%20%20TELLY%20%22%3B%3ANEXT%0A40REPEATUNTILFALSE%0A50DATA7%2C3%2C6%2C2%2C5%2C1%2C4%2C0%0A"></iframe>
<figcaption>PAL simulation</figcaption>
</figure>
</div>

Notes:
Why do I care? I write jsbeeb, a BBC Micro emulator. Nobody in 1982 saw crisp square pixels: they
saw a BBC Micro through the aerial socket of the family telly. So jsbeeb grew a PAL simulation.
It looks right-ish. But how right?
