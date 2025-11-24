// shader5.js

document.addEventListener('DOMContentLoaded', function () {
  console.log('shader2.js: DOMContentLoaded');

  var canvas = document.getElementById('shader-canvas');
  console.log('shader2.js: canvas =', canvas);
  if (!canvas) {
    // На этой странице нет блока с канвасом — просто выходим
    return;
  }

  // Логируем потерю контекста (особенно актуально для мобилок)
  canvas.addEventListener('webglcontextlost', function (e) {
    console.warn('shader2.js: WebGL context LOST', e);
  });

  var gl = canvas.getContext('webgl');
  console.log('shader2.js: gl =', gl);
  if (!gl) {
    console.warn('shader2.js: WebGL is not supported');
    return;
  }

  var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  function resizeCanvas() {
    // УПРОЩАЕМ: без hiDPI, один логический пиксель = один физический
    var dpr = 1.0;

    var displayWidth  = Math.round(canvas.clientWidth  * dpr);
    var displayHeight = Math.round(canvas.clientHeight * dpr);

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      gl.viewport(0, 0, displayWidth, displayHeight);
      console.log('shader2.js: resized to', displayWidth, displayHeight);
    }
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  var vertexShaderSource = `
    attribute vec2 aPosition;
    void main() {
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  var fragmentShaderSource = `
    precision highp float;

    uniform vec3  iResolution;
    uniform float iTime;
    uniform int   iFrame;
    uniform float uMaxIter; // максимум шагов реймарчинга

    // tanh-заменитель
    float myTanh(float x) {
      float e2x = exp(2.0 * x);
      return (e2x - 1.0) / (e2x + 1.0);
    }

    vec3 myTanh(vec3 x) {
      vec3 e2x = exp(2.0 * x);
      return (e2x - 1.0) / (e2x + 1.0);
    }

    #define R(a) mat2(cos((a) + vec4(0.0, -11.0, 11.0, 0.0)))

    void mainImage( out vec4 fragColor, in vec2 fragCoord )
    {
      // нормализованные координаты
      vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
      // отражаем по горизонтали
      uv.x = -uv.x;

      vec3 color = vec3(0.0);

      float speed = -3.5;
      float pos = iTime * speed;

      float focal = 2.0;

      float r = 200.0;
      vec3 rd = normalize(vec3(uv, -focal));
      vec3 ro = vec3( cos(pos/r)*r, 3.0 + sin(0.1*pos), sin(pos/r)*r );

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

      // В WebGL1 нельзя использовать t в условии for, делаем break внутри
      for (int i = 0; i < 99; i++)
      {
        // ограничиваем количество шагов через uniform uMaxIter
        if (float(i) > uMaxIter) break;
        if (t > 1000.0) break;

        vec3 p = rd * t + ro;
        vec3 q = p;

        // ВНУТРЕННИЙ ЦИКЛ: int-индекс, j считается от 0.01, *2 каждый шаг
        for (int k = 0; k < 12; k++) {
          float j = 0.01 * pow(2.0, float(k)); // 0.01, 0.02, 0.04, ...
          if (j > 11.0) break;

          p.xz *= M;
          p.xz -= 1.3 * j;
          p += 0.4 * j * cos(p.zxy / j);
        }

        float sdf = max(p.y + 1.5, 0.0);

        sdf = mix(sdf, min(sdf, (7.0 - 0.2 * p.y)), daynight);
        float dt = abs(sdf) * 0.3 + 1e-3;

        float phase = p.y * 0.3 +
                      0.1 * (t + 1.5 * iTime) +
                      length(p - ro) * 0.1;

        vec3 cmap = (1.0 + -cos(phase + vec3(1.0, 2.0, 3.0)))
                    * exp2(2.65 * myTanh(q.y * 0.55) - 1.55)
                    * exp2(-0.01 * t);

        color += cmap * dt / (sdf * sdf + 1.0);

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
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('shader2.js: Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(gl, vsSource, fsSource) {
    var vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    var fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return null;

    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('shader2.js: Program link error:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  var program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
  if (!program) return;

  gl.useProgram(program);

  var positionLocation = gl.getAttribLocation(program, 'aPosition');
  var positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  var vertices = new Float32Array([
    -1.0, -1.0,
     1.0, -1.0,
    -1.0,  1.0,
    -1.0,  1.0,
     1.0, -1.0,
     1.0,  1.0
  ]);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  var iResolutionLocation = gl.getUniformLocation(program, 'iResolution');
  var iTimeLocation       = gl.getUniformLocation(program, 'iTime');
  var iFrameLocation      = gl.getUniformLocation(program, 'iFrame');
  var uMaxIterLocation    = gl.getUniformLocation(program, 'uMaxIter');

  // Лимит шагов: мобильным меньше, десктопу больше
  var maxIterValue = isMobile ? 40.0 : 80.0;
  gl.uniform1f(uMaxIterLocation, maxIterValue);

  var startTime = performance.now();
  var frame = 0;

  function render() {
    resizeCanvas();

    var t = (performance.now() - startTime) / 1000.0;
    gl.uniform1f(iTimeLocation, t);
    gl.uniform3f(iResolutionLocation, canvas.width, canvas.height, 1.0);
    gl.uniform1i(iFrameLocation, frame++);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }

  render();
});
