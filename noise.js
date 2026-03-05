/*

Noise functions for TSL (Three.js Shading Language)

Provides a base 3D Perlin noise and two layered noise types built on top:
  - Fractal Brownian Motion (FBM): smooth, natural terrain
  - Ridged Noise: sharp creases and mountain-like ridges

FBM and Ridged Noise reference:
https://threejsroadmap.com/blog/10-noise-functions-for-threejs-tsl-shaders

@LukaPiskorec 2026

*/


import {
  Fn, float, vec3,
  floor, fract, sin, cos, dot, mix,
  abs, oneMinus, Loop,
  length, min
} from 'three/tsl';


// ─── 3D Perlin Noise (base) ──────────────────────────────────


const randomGradient3D = Fn( ( [ p ] ) => {

  const phi   = fract( sin( dot( p, vec3( 127.1, 311.7, 74.7 ) ) ).mul( 43758.5453 ) ).mul( Math.PI * 2 );
  const theta = fract( sin( dot( p, vec3( 269.5, 183.3, 246.1 ) ) ).mul( 43758.5453 ) ).mul( Math.PI );
  return vec3(
    sin( theta ).mul( cos( phi ) ),
    sin( theta ).mul( sin( phi ) ),
    cos( theta )
  );

} );


const perlinNoise3D = Fn( ( [ p ] ) => {

  const i = floor( p ).toVar();
  const f = fract( p ).toVar();

  const u = f.mul( f ).mul( float( 3.0 ).sub( f.mul( 2.0 ) ) );

  const g000 = randomGradient3D( i );
  const g100 = randomGradient3D( i.add( vec3( 1.0, 0.0, 0.0 ) ) );
  const g010 = randomGradient3D( i.add( vec3( 0.0, 1.0, 0.0 ) ) );
  const g110 = randomGradient3D( i.add( vec3( 1.0, 1.0, 0.0 ) ) );
  const g001 = randomGradient3D( i.add( vec3( 0.0, 0.0, 1.0 ) ) );
  const g101 = randomGradient3D( i.add( vec3( 1.0, 0.0, 1.0 ) ) );
  const g011 = randomGradient3D( i.add( vec3( 0.0, 1.0, 1.0 ) ) );
  const g111 = randomGradient3D( i.add( vec3( 1.0, 1.0, 1.0 ) ) );

  const d000 = dot( g000, f );
  const d100 = dot( g100, f.sub( vec3( 1.0, 0.0, 0.0 ) ) );
  const d010 = dot( g010, f.sub( vec3( 0.0, 1.0, 0.0 ) ) );
  const d110 = dot( g110, f.sub( vec3( 1.0, 1.0, 0.0 ) ) );
  const d001 = dot( g001, f.sub( vec3( 0.0, 0.0, 1.0 ) ) );
  const d101 = dot( g101, f.sub( vec3( 1.0, 0.0, 1.0 ) ) );
  const d011 = dot( g011, f.sub( vec3( 0.0, 1.0, 1.0 ) ) );
  const d111 = dot( g111, f.sub( vec3( 1.0, 1.0, 1.0 ) ) );

  return mix(
    mix( mix( d000, d100, u.x ), mix( d010, d110, u.x ), u.y ),
    mix( mix( d001, d101, u.x ), mix( d011, d111, u.x ), u.y ),
    u.z
  ).add( 0.5 );

} );


// ─── Fractal Brownian Motion ──────────────────────────────────


function createFBM( { octaves = 6, lacunarity = 2.0, gain = 0.5 } = {} ) {

  return Fn( ( [ p ] ) => {

    const value     = float( 0 ).toVar();
    const amplitude = float( 0.5 ).toVar();
    const frequency = float( 1 ).toVar();

    Loop( octaves, () => {
      value.addAssign( amplitude.mul( perlinNoise3D( p.mul( frequency ) ) ) );
      frequency.mulAssign( lacunarity );
      amplitude.mulAssign( gain );
    } );

    return value;

  } );

}


// ─── Ridged Noise ─────────────────────────────────────────────


function createRidgedNoise( { octaves = 6, lacunarity = 2.0, gain = 0.5 } = {} ) {

  return Fn( ( [ p ] ) => {

    const value     = float( 0 ).toVar();
    const amplitude = float( 0.5 ).toVar();
    const frequency = float( 1 ).toVar();
    const weight    = float( 1 ).toVar();

    Loop( octaves, () => {
      const n      = oneMinus( abs( perlinNoise3D( p.mul( frequency ) ).sub( 0.5 ).mul( 2 ) ) );
      const signal = n.mul( n ).mul( weight );
      value.addAssign( signal.mul( amplitude ) );
      weight.assign( signal.clamp( 0, 1 ) );
      frequency.mulAssign( lacunarity );
      amplitude.mulAssign( gain );
    } );

    return value;

  } );

}


// ─── Worley (Voronoi) Noise 3D ───────────────────────────────


const hash33 = Fn( ( [ p ] ) => {

  const px = fract( sin( dot( p, vec3( 127.1, 311.7, 74.7 ) ) ).mul( 43758.5453 ) );
  const py = fract( sin( dot( p, vec3( 269.5, 183.3, 246.1 ) ) ).mul( 43758.5453 ) );
  const pz = fract( sin( dot( p, vec3( 419.2, 371.9, 128.5 ) ) ).mul( 43758.5453 ) );
  return vec3( px, py, pz );

} );


const worleyNoise3D = Fn( ( [ p ] ) => {

  const i = floor( p ).toVar();
  const f = fract( p ).toVar();

  const minDist = float( 1.0 ).toVar();

  Loop( { start: -1, end: 2, type: 'int' }, ( { i: x } ) => {
    Loop( { start: -1, end: 2, type: 'int' }, ( { i: y } ) => {
      Loop( { start: -1, end: 2, type: 'int' }, ( { i: z } ) => {

        const neighbor = vec3( float( x ), float( y ), float( z ) );
        const point = hash33( i.add( neighbor ) );
        const diff = neighbor.add( point ).sub( f );
        const dist = length( diff );
        minDist.assign( min( minDist, dist ) );

      } );
    } );
  } );

  return minDist;

} );


// ─── Expose to sketch.js ─────────────────────────────────────
// (p5.js web editor doesn't support relative ES module imports,
//  so we bridge via window instead)


window.NoiseLib = { createFBM, createRidgedNoise, worleyNoise3D };
