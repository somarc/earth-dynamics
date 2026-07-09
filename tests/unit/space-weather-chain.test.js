import { describe, expect, it } from 'vitest';
import { evaluateSpaceWeatherChain } from '../../src/space-weather-chain.js';

describe('evaluateSpaceWeatherChain', () => {
  it('is inactive when only one step is present', () => {
    const chain = evaluateSpaceWeatherChain({
      geomagnetic: { kpMax: 3, dstMin: -10 },
      spaceWeather: [],
    });
    expect(chain.active).toBe(false);
    expect(chain.steps).toEqual([]);
  });

  it('links CME + G5 storm + aurora on the May 2024 fixture shape', () => {
    const chain = evaluateSpaceWeatherChain({
      geomagnetic: {
        kpMax: 9,
        dstMin: -412,
        swBzNt: -40,
      },
      spaceWeather: [
        { eventType: 'CME', speed: 1900 },
        { eventType: 'GST', magnitude: 'G5', kpPeak: 9 },
        { eventType: 'FLR', magnitude: 'X5.0' },
      ],
    });
    expect(chain.cme).toBe(true);
    expect(chain.flare).toBe(true);
    expect(chain.gst).toBe(true);
    expect(chain.dstStorm).toBe(true);
    expect(chain.kpStorm).toBe(true);
    expect(chain.aurora).toBe(true);
    expect(chain.strongWind).toBe(true);
    expect(chain.active).toBe(true);
    expect(chain.steps).toEqual(expect.arrayContaining(['cme', 'flare', 'storm', 'aurora']));
  });

  it('treats OVATION nowcast as aurora step', () => {
    const chain = evaluateSpaceWeatherChain(
      { geomagnetic: { kpMax: 2 }, spaceWeather: [{ eventType: 'CME' }] },
      { ovationMode: true },
    );
    expect(chain.aurora).toBe(true);
    expect(chain.active).toBe(true);
  });
});
