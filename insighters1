const canvas = document.getElementById('shaderCanvas');
const gl = canvas.getContext('webgl');

if (!gl) {
  console.error('WebGL not supported');
}

/* ===== Resize with limited DPR ===== */
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

/* ===== Vertex shader ===== */
const vertexSrc = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/* ===== Fragment shader (optimized) ===== */
const fragmentSrc = `
precision highp float;

uniform vec2 iResolution;
uniform float iTime;

mat2 rot(float a){
  float c = cos(a), s = sin(a);
  return mat2(c,-s,s,c);
}

float map(vec3 p){
  p.xz *= rot(iTime * 0.4);
  p.xy *= rot(iTime * 0.3);
  vec3 q = p * 2.0 + iTime;
  return length(p + vec3(sin(iTime * 0.7)))
       * log(length(p) + 1.0)
       + sin(q.x + sin(q.z + sin(q.y))) * 0.5
       - 1.0;
}

void main(){
  vec2 uv = gl_FragCoord.xy / iResolution.y - vec2(0.9, 0.5);

  vec3 col = vec3(0.0);
  float d = 2.5;

  for(int i = 0; i < 5; i++){
    if(d > 6.0) break;

    vec3 p = vec3(0.0, 0.0, 5.0)
           + normalize(vec3(uv, -1.0)) * d;

    float rz = map(p);

    // упрощённая "нормаль"
    float rz2 = map(p + 0.15);
    float f = clamp((rz - rz2) * 0.4, -0.1, 1.0);

    vec3 light = vec3(0.1,0.3,0.4)
               + vec3(5.0,2.5,3.0) * f;

    col = col * light
        + (1.0 - smoothstep(0.0, 2.5, rz)) * 0.7 * light;

    d += min(rz, 1.0);
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

/* ===== Compile helpers ===== */
function compile(type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

/* ===== Program ===== */
const program = gl.createProgram();
gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSrc));
gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSrc));
gl.linkProgram(program);
gl.useProgram(program);

/* ===== Fullscreen quad ===== */
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array([-1,-1, 1,-1, -1,1, 1,1]),
  gl.STATIC_DRAW
);

const posLoc = gl.getAttribLocation(program, 'position');
gl.enableVertexAttribArray(posLoc);
gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

/* ===== Uniforms ===== */
const timeLoc = gl.getUniformLocation(program, 'iTime');
const resLoc  = gl.getUniformLocation(program, 'iResolution');

/* ===== Render loop (≈30 FPS) ===== */
let start = performance.now();
let lastFrame = 0;

function render(t){
  if (t - lastFrame < 33) {
    requestAnimationFrame(render);
    return;
  }
  lastFrame = t;

  gl.uniform1f(timeLoc, (t - start) * 0.001);
  gl.uniform2f(resLoc, canvas.width, canvas.height);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  requestAnimationFrame(render);
}

requestAnimationFrame(render);
