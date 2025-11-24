(function () {
  console.log("shader.js: DOMContentLoaded");

  function getCanvas() {
    const canvas = document.getElementById("shader-canvas");
    console.log("shader.js: canvas =", canvas);
    return canvas;
  }

  const canvas = getCanvas();
  if (!canvas) return;

  const gl = canvas.getContext("webgl");
  console.log("shader.js: gl =", gl);

  if (!gl) {
    console.warn("WebGL is not supported");
    return;
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.round(canvas.clientWidth * dpr);
    const displayHeight = Math.round(canvas.clientHeight * dpr);

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      gl.viewport(0, 0, displayWidth, displayHeight);
      console.log("shader.js: resized to", displayWidth, displayHeight);
    }
  }

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  const vertexShaderSource = `
    attribute vec2 aPosition;
    void main() {
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = `
    precision highp float;

    uniform vec3  iResolution;
    uniform float iTime;
    uniform int   iFrame;

    float myTanh(float x) {
      float e2x = exp(2.0 * x);
      return (e2x - 1.0) / (e2x + 1.0);
    }

    vec3 myTanh(vec3 x) {
      vec3 e2x = exp(2.0 * x);
      return (e2x - 1.0) / (e2x + 1.0);
    }

    #define R(a) mat2(cos((a) + vec4(0.0, -11.0, 11.0, 0.0)))

    void mainImage(out vec4 fragColor, in vec2 fragCoord)
    {
      vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;

      vec3 color = vec3(0.0);

      float speed = -3.5;
      float pos = iTime * speed;

      float focal = 2.0;

      float r = 200.0;
      vec3 rd = normalize(vec3(uv, -focal));
      vec3 ro = vec3(
        cos(pos/r)*r,
        3.0 + sin(0.1*pos),
        sin(pos/r)*r
      );

      rd.xy *= R(0.3 * sin(0.1 * iTime) + 0.4);
      rd.xz *= R(pos / r);

      float hash = fract(
        631.123123 * sin(
          float(iFrame) +
          length(uv) * 331.0 +
          dot(uv, vec2(111.123123, 171.3123))
        )
      );

      float t = 1.0 + 0.2 * hash;
      const float phi = sqrt(5.0) * 0.5 + 0.5;
      float daynight = smoothstep(-0.6, 0.6, sin(iTime * 0.05));

      mat2 M = R(phi * 3.1415);

      for (int i = 0; i < 99; i++) {
        if (t > 1000.0) break;

        vec3 p = rd * t + ro;
        vec3 q = p;

        // ✅ ИСПРАВЛЕННЫЙ ЦИКЛ j
        for (float j = 0.01; j < 11.0; j *= 2.0) {
          p.xz *= M;
          p.xz -= 1.3 * j;
          p += 0.4 * j * cos(p.zxy / j);
        }

        float sdf = max(p.y + 1.5, 0.0);
        sdf = mix(sdf, min(sdf, (7.0 - 0.2*p.y)), daynight);

        float dt = abs(sdf) * 0.3 + 0.001;

        float phase = p.y * 0.3 +
                      0.1*(t + 1.5*iTime) +
                      length(p - ro) * 0.1;

        vec3 cmap =
          (1.0 + -cos(phase + vec3(1.0, 2.0, 3.0))) *
          exp2(2.65 * myTanh(q.y * 0.55) - 1.55) *
          exp2(-0.01 * t);

        color += cmap * dt / (sdf*sdf + 1.0);

        t += dt;
      }

      color = myTanh(0.0025 * color * color);
      color = pow(color, vec3(1.0 / 2.2));

      fragColor = vec4(color, 1.0);
    }

    void main() {
      vec4 col;
      mainImage(col, gl_FragCoord.xy);
      gl_FragColor = col;
    }
  `;

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(gl, vsSource, fsSource) {
    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
  if (!program) return;

  gl.useProgram(program);

  const posLoc = gl.getAttribLocation(program, "aPosition");
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);

  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]),
    gl.STATIC_DRAW
  );

  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const resLoc = gl.getUniformLocation(program, "iResolution");
  const timeLoc = gl.getUniformLocation(program, "iTime");
  const frameLoc = gl.getUniformLocation(program, "iFrame");

  let start = performance.now();
  let frame = 0;

  function render() {
    resizeCanvas();
    const t = (performance.now() - start) / 1000;

    gl.uniform1f(timeLoc, t);
    gl.uniform3f(resLoc, canvas.width, canvas.height, 1);
    gl.uniform1i(frameLoc, frame++);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }

  render();
})();
