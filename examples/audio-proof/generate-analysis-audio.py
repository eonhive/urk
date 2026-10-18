# Company: EonHive Inc. | Title: Audio Analysis Demo Fixture
# Purpose: Generate a short original loop with independently varying low, mid, and high frequencies.
# Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
# Notes: Vibe coded with Codex.

import array
import math
from pathlib import Path
import random
import sys
import wave

sample_rate = 22050
duration = 8
noise = random.Random(17)
samples = array.array('h')
previous_noise = 0
for index in range(sample_rate * duration):
    time = index / sample_rate
    beat = time % 0.5
    bass = 0.4 * math.exp(-beat * 7) * math.sin(math.tau * 110 * time)
    chord = sum(math.sin(math.tau * hz * time) for hz in (330, 440, 660)) / 3
    mids = 0.22 * (0.55 + 0.45 * math.sin(math.tau * time / 4)) * chord
    current_noise = noise.uniform(-1, 1)
    # A noise difference emphasizes highs, making the treble output visibly independent.
    treble = 0.18 * math.exp(-(time % 0.25) * 20) * (current_noise - previous_noise)
    previous_noise = current_noise
    fade = min(1, time / 0.01, (duration - time) / 0.01)
    samples.append(round(max(-1, min(1, (bass + mids + treble) * fade)) * 32767))

if sys.byteorder != 'little':
    samples.byteswap()
output = Path(__file__).resolve().parents[1] / 'public' / 'audio' / 'analysis.wav'
with wave.open(str(output), 'wb') as audio:
    audio.setparams((1, 2, sample_rate, 0, 'NONE', 'not compressed'))
    audio.writeframes(samples.tobytes())
