# The Ministry of Approvals: design spec v1 (21 Sep 2026)

Build target: `web/` (Astro 7). Replaces the cream-paper placeholder look. If something is not
specified, copy the closest specified pattern.

## The idea in one line

The Ministry is a real building and you are holding real paper. Everything on screen is either a
surface of the building (plaster wall, wood desk, filing cabinet) or a physical document (form,
receipt, certificate, stamp). Nothing is a "card".

## Research: what we steal, and from whom

| Reference | Pattern taken |
|---|---|
| Wes Anderson title cards (Grand Budapest Hotel) | Symmetry, centred typewriter captions, brass plates, one saturated colour per department |
| Real Soviet and Lithuanian ministry forms (1970s to 1990s) | Serial in a boxed corner, "Form No." eyebrow, dotted fill lines, carbon copy blue text on the copy |
| Rubber stamp physics | Ink is never uniform: a mask of noise, a slight rotation, heavier ink at one edge, overlap allowed |
| Passport and diploma engraving | Guilloche border on the certificate, an embossed seal, a signature line, a serial punched at the edge |
| Flighty status chips | State is colour + word + motion, never colour alone; one medium motion per state change, nothing decorative |

## Surfaces (colour tokens)

```
--plaster:  #d8d2c2   page background, the corridor wall
--dado:     #4f6b52   institutional green lower wall band on the corridor
--desk:     #5a4634   wood, footer and the Minister's surfaces
--paper:    #fbf7ec   forms, receipts, certificate
--manila:   #e6d3a3   folders, the status page holder
--carbon:   #3a4a7c   carbon copy blue, typed copies and links
--ink:      #1b1916   text
--ink-2:    #5c554b   secondary text
--stamp-red:   #b3261e  stamps only, never decoration
--stamp-green: #2f6b3a  the Minister's approval and certified state only
--stamp-blue:  #2b4c8c  Front Desk and Rubber Stamps
--brass:    #c9a227   plates, seal, certificate border
```

## Type

- `Fraunces` (opsz, 700 and 900): headings, certificate title. Display size only.
- `Special Elite`: everything the Ministry typed itself: serials, form numbers, demands, receipts,
  stamps' small print, the movements log. It is the voice of the machine.
- `IBM Plex Sans`: body, form inputs, buttons.
- Sizes: 16 base, headings clamp(30px, 5vw, 52px), typewriter 14 to 15.

## Objects

**Form sheet**: paper with two punched holes on the left, a boxed serial top right ("No. 0004"),
an eyebrow "FORM MoA-1 (rev. 7)", dotted underlines under field values. The citizen's text sits
in a slightly darker "typed" block.

**Stamp**: uppercase Special Elite or Fraunces 900, 2px solid border, radius 4, rotated between
-6 and 4 degrees, ink mask (SVG turbulence at 0.35 opacity), `mix-blend-mode: multiply`. Slams in:
`scale(1.5) rotate(x-8deg)` to rest in 260 ms with a spring-ish curve, once per state change.

**Door**: SVG, 120 by 190, wood frame, frosted glass upper pane with the department name in
reversed typewriter text, brass plate with motto, the department colour as the frame accent.
The current door has a warm glow behind the glass. Visited doors show a small stamp on the glass.

**Paper sprite** on the status page: a small form that sits in front of the current door and
slides along the corridor (CSS transition on `left`, 700 ms) when the stage changes.

**Certificate**: 3:2 landscape, paper, double guilloche border in brass (CSS repeating
gradients, not an image), corner ornaments, Fraunces 900 title "CERTIFICATE OF APPROVAL", the
submission title in Fraunces 700, three to four rotated stamps overlapping the lower half,
the Minister's note in Special Elite, an embossed round seal (SVG) bottom right, signature line
bottom left, serial punched on the right edge. Same layout renders to PNG for Discord and
sharing (satori + resvg).

**Receipt**: narrow, white, torn bottom edge (CSS zigzag), monospace, "RECEIPT FOR A LOST FORM".

**Wall**: plaster with a dado band, certificates hung in brass frames at -1.5 to 1.5 degree
tilts, a small brass plaque under each with the serial and the date.

**Filing cabinet** (Hall of Lost Forms): grey steel drawers, each receipt in a drawer face.

## Motion rules

One meaningful motion per state change. Stamps slam. Paper slides. Doors glow. Nothing loops,
nothing bounces for fun. `prefers-reduced-motion`: no transforms, opacity only.

## Voice on the surfaces

The Ministry talks in Special Elite, short, formal, occasionally wrong. The site copy (Plex) is
the narrator, dry. No exclamation marks. No em dashes anywhere.
