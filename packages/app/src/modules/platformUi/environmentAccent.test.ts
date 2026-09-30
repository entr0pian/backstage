import { environmentAccent } from './environmentAccent';

describe('environmentAccent', () => {
  it('gives known environments fixed colours', () => {
    expect(environmentAccent('dev')).toEqual(environmentAccent('DEV'));
    expect(environmentAccent('prod')).not.toEqual(environmentAccent('dev'));
  });

  it('gives any other environment a stable colour', () => {
    expect(environmentAccent('qa-eu')).toEqual(environmentAccent('qa-eu'));
  });
});
