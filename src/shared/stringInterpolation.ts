import createInterpolator from '../animated/createInterpolator'
import { InterpolationConfig } from '../types/interpolation'
import colors from './colors'
import normalizeColor from './normalizeColors'

function colorToRgba(input: string) {
  let int32Color = normalizeColor(input)
  if (int32Color === null) return input
  int32Color = int32Color || 0
  let r = (int32Color & 0xff000000) >>> 24
  let g = (int32Color & 0x00ff0000) >>> 16
  let b = (int32Color & 0x0000ff00) >>> 8
  let a = (int32Color & 0x000000ff) / 255
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

// Problem: https://github.com/animatedjs/animated/pull/102
// Solution: https://stackoverflow.com/questions/638565/parsing-scientific-notation-sensibly/658662
const stringShapeRegex = /[+\-]?(?:0|[1-9]\d*)(?:\.\d*)?(?:[eE][+\-]?\d+)?/g
// Covers rgb, rgba, hsl, hsla
// Taken from https://gist.github.com/olmokramer/82ccce673f86db7cda5e
const colorRegex = /(#(?:[0-9a-f]{2}){2,4}|(#[0-9a-f]{3})|(rgb|hsl)a?\((-?\d+%?[,\s]+){2,3}\s*[\d\.]+%?\))/gi
// Covers color names (transparent, blue, etc.)
const colorNamesRegex = new RegExp(`(${Object.keys(colors).join('|')})`, 'g')

/**
 * Supports string shapes by extracting numbers so new values can be computed,
 * and recombines those values into new strings of the same shape.  Supports
 * things like:
 *
 *   rgba(123, 42, 99, 0.36)           // colors
 *   -45deg                            // values with units
 *   0 2px 2px 0px rgba(0, 0, 0, 0.12) // box shadows
 */
const createStringInterpolator = (config: InterpolationConfig<string>) => {
  // Replace colors with rgba
  const outputRange = config.output
    .map(rangeValue => rangeValue.replace(colorRegex, colorToRgba))
    .map(rangeValue => rangeValue.replace(colorNamesRegex, colorToRgba))

  const outputRanges: number[][] = outputRange[0]
    .match(stringShapeRegex)!
    .map(() => [])
  outputRange.forEach(value => {
    value
      .match(stringShapeRegex)!
      .forEach((number, i) => outputRanges[i].push(+number))
  })
  const interpolations = outputRange[0]
    .match(stringShapeRegex)!
    .map((_value, i) =>
      createInterpolator({ ...config, output: outputRanges[i] })
    )
  return (input: number) => {
    let i = 0
    return (
      outputRange[0]
        // 'rgba(0, 100, 200, 0)'
        // ->
        // 'rgba(${interpolations[0](input)}, ${interpolations[1](input)}, ...'
        .replace(
          stringShapeRegex,
          () => (interpolations[i++](input) as unknown) as string
        )
        // rgba requires that the r,g,b are integers.... so we want to round them, but we *dont* want to
        // round the opacity (4th column).
        .replace(
          /rgba\(([0-9\.-]+), ([0-9\.-]+), ([0-9\.-]+), ([0-9\.-]+)\)/gi,
          (_, p1: number, p2: number, p3: number, p4: number) =>
            `rgba(${Math.round(p1)}, ${Math.round(p2)}, ${Math.round(
              p3
            )}, ${p4})`
        )
    )
  }
}

export default createStringInterpolator
