const canvas = document.getElementById('shaderCanvas');
const gl = canvas.getContext('webgl');

if (!gl) {
  console.error('WebGL not supported');
}

/* resize */
function resize() {
  const dpr = Math.min(window.devicePixelRatio, 2);
  canvas.width  = canvas.clientWidth  * dpr;
  canvas.height = canvas.clientHeight * dpr;
  gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

/* vertex */
const vertexSrc = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/* fragment (адаптация шейдера nimitz) */
const fragmentSrc = `
precision highp float;

uniform vec2 iResolution;
uniform float iTime;

mat2 m(float a){
  float c = cos(a), s = sin(a);
  return mat2(c,-s,s,c);
}

float map(vec3 p){
  p.xz *= m(iTime * 0.4);
  p.xy *= m(iTime * 0.3);
  vec3 q = p * 2. + iTime;
  return length(p + vec3(sin(iTime * 0.7)))
       * log(length(p) + 1.)
       + sin(q.x + sin(q.z + sin(q.y))) * 0.5
       - 1.;
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 uv = fragCoord / iResolution.y - vec2(0.9, 0.5);

  vec3 col = vec3(0.0);
  float d = 2.5;

  for(int i = 0; i < 6; i++){
    vec3 p = vec3(0.0, 0.0, 5.0) + normalize(vec3(uv, -1.0)) * d;
    float rz = map(p);
    float f = clamp((rz - map(p + 0.1)) * 0.5, -0.1, 1.0);
    vec3 l = vec3(0.1,0.3,0.4) + vec3(5.0,2.5,3.0) * f;
    col = col * l + (1.0 - smoothstep(0.0, 2.5, rz)) * 0.7 * l;
    d += min(rz, 1.0);
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

/* compile */
function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
  }
  return s;
}

const program = gl.createProgram();
gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSrc));
gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSrc));
gl.linkProgram(program);
gl.useProgram(program);

/* quad */
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array([-1,-1, 1,-1, -1,1, 1,1]),
  gl.STATIC_DRAW
);

const pos = gl.getAttribLocation(program, 'position');
gl.enableVertexAttribArray(pos);
gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

/* uniforms */
const timeLoc = gl.getUniformLocation(program, 'iTime');
const resLoc  = gl.getUniformLocation(program, 'iResolution');

/* render */
let start = performance.now();
function render(t){
  gl.uniform1f(timeLoc, (t - start) * 0.001);
  gl.uniform2f(resLoc, canvas.width, canvas.height);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
