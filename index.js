/*

FBM / Ridged Noise Heightmap

A subdivided plane with vertices displaced by layered noise functions:
  - Fractal Brownian Motion (FBM): smooth, organic terrain
  - Ridged Noise: sharp creases and mountain-like ridges

Both are built on 3D Perlin noise and animated by scrolling through
the noise field over time. Switch between them with NOISE_TYPE below.

Based on the perlin_noise_heightmap example.

@LukaPiskorec 2026

*/


import * as THREE from 'three';
import { Fn, uniform, float, vec3, positionLocal, normalLocal } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const { createFBM, createRidgedNoise } = window.NoiseLib;


// ─── Configuration ────────────────────────────────────────────


// noise type: 'fbm' or 'ridged'
const NOISE_TYPE = 'ridged';

// noise layering parameters (baked at shader compile time)
const OCTAVES    = 1;      // number of noise layers
const LACUNARITY = 1.0;    // frequency multiplier per octave
const GAIN       = 2;    // amplitude multiplier per octave

// displacement
const NOISE_SCALE            = 0.4;   // spatial frequency of the noise
const DISPLACEMENT_STRENGTH  = 3;   // how far vertices are pushed

// animation — direction and speed of noise travel
const TRAVEL_DIRECTION = [ 0, 0, 1 ];  // axis of travel through noise field
const TRAVEL_SPEED     = 2;          // units per second


// ─── Renderer & Scene ─────────────────────────────────────────


const renderer = new THREE.WebGPURenderer( {
  canvas: document.querySelector( '#canvas' ),
  antialias: true,
} );
renderer.setSize( window.innerWidth, window.innerHeight );
await renderer.init();

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x000000 );

const camera = new THREE.PerspectiveCamera(
  45, window.innerWidth / window.innerHeight, 1, 1000
);
camera.position.set( 0, 8, 8 );

const controls = new OrbitControls( camera, renderer.domElement );
controls.update();


// ─── Noise Displacement ───────────────────────────────────────


const noiseParams = { octaves: OCTAVES, lacunarity: LACUNARITY, gain: GAIN };

const noiseFn = NOISE_TYPE === 'ridged'
  ? createRidgedNoise( noiseParams )
  : createFBM( noiseParams );

const uTime = uniform( 0.0 );
const travelDir = vec3( TRAVEL_DIRECTION[ 0 ], TRAVEL_DIRECTION[ 1 ], TRAVEL_DIRECTION[ 2 ] );

// vertex displacement: push each vertex along its normal by noise value
const displacedPosition = Fn( () => {

  const pos = positionLocal.toVar();
  const nrm = normalLocal.toVar();

  const noiseInput = pos.mul( NOISE_SCALE ).add( travelDir.mul( uTime ) );
  const noiseVal   = noiseFn( noiseInput ).sub( 0.5 ).mul( DISPLACEMENT_STRENGTH );

  return pos.add( nrm.mul( noiseVal ) );

} )();


// ─── Geometry & Material ──────────────────────────────────────


const geometry = new THREE.PlaneGeometry( 10, 10, 100, 100 );

const material = new THREE.MeshNormalMaterial( { flatShading: true, side: THREE.DoubleSide } );
material.positionNode = displacedPosition;

const mesh = new THREE.Mesh( geometry, material );
mesh.rotation.x = -Math.PI / 2;
scene.add( mesh );


// ─── Animation Loop ───────────────────────────────────────────


let time = Date.now();

renderer.setAnimationLoop( () => {

  const currentTime = Date.now();
  const deltaTime   = currentTime - time;
  time = currentTime;

  uTime.value += deltaTime * 0.001 * TRAVEL_SPEED;

  renderer.render( scene, camera );

} );
