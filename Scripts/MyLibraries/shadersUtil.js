const UNIFORM_VAR_TYPE = {
    U1F: 0,
    U2F: 1,
    U3F: 2,
    U4F: 3,
};

class ShaderCanvas {
    constructor(canvas, vertexShaderSource, fragmentShaderSource) {
        this.canvas = canvas;
        this.gl = canvas.getContext("webgl");
        if (!this.gl) {
            console.error("WebGL not supported");
            return;
        }

        this.shaderVariables = {};

        this.vertexShaderSource = vertexShaderSource;
        this.fragmentShaderSource = fragmentShaderSource;

        this.initShaderProgram();
        this.initBuffers();
        this.resize();

        this.lastAnimationFrameID = -1;
        
        window.addEventListener("resize", () => this.resize());
    }

    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error(`Shader compile error: ${this.gl.getShaderInfoLog(shader)}`);
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    initShaderProgram() {
        const gl = this.gl;
        const vertexShader = this.createShader(gl.VERTEX_SHADER, this.vertexShaderSource);
        const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, this.fragmentShaderSource);
        
        if (!vertexShader || !fragmentShader) {
            console.error("Failed to compile shaders");
            return;
        }
        
        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);
        
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            console.error(`Program link error: ${gl.getProgramInfoLog(this.program)}`);
            gl.deleteProgram(this.program);
            return;
        }

        gl.useProgram(this.program);
        this.positionAttributeLocation = gl.getAttribLocation(this.program, "a_position");

        this.timeUniformLocation = gl.getUniformLocation(this.program, "u_time");
        this.resolutionUniformLocation = gl.getUniformLocation(this.program, "u_resolution");

        // Update any variable locations
        for (const varName in this.shaderVariables) {
            this.shaderVariables[varName][1] = gl.getUniformLocation(this.program, varName);
        }
    }

    initBuffers() {
        const gl = this.gl;
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);

        const positions = [
            -1, -1, 
             1, -1, 
            -1,  1, 
            -1,  1, 
             1, -1, 
             1,  1
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    }

    resize() {
        const gl = this.gl;
        const realToCSSPixels = window.devicePixelRatio || 1;
        const displayWidth  = Math.floor(this.canvas.clientWidth  * realToCSSPixels);
        const displayHeight = Math.floor(this.canvas.clientHeight * realToCSSPixels);

        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        }
    }

    render(time) {
        time *= 0.001;
        const gl = this.gl;
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.uniform1f(this.timeUniformLocation, time);
        gl.uniform2f(this.resolutionUniformLocation, this.canvas.width, this.canvas.height);
        for (const varName in this.shaderVariables) {
            const valType = this.shaderVariables[varName][0];
            const loc = this.shaderVariables[varName][1];
            const value = this.shaderVariables[varName][2];
            switch (valType) {
                case UNIFORM_VAR_TYPE.U1F:
                    gl.uniform1f(loc, value);
                    break;
                case UNIFORM_VAR_TYPE.U2F:
                    gl.uniform2f(loc, value[0], value[1]);
                    break;
                case UNIFORM_VAR_TYPE.U3F:
                    gl.uniform2f(loc, value[0], value[1], value[2]);
                    break;
                case UNIFORM_VAR_TYPE.U4F:
                    gl.uniform2f(loc, value[0], value[1], value[2], value[3]);
                    break;
                default:
                    console.error(`Trying to set an unsupported variable type "${valType}" in shader.`);
                    break;
            }
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(this.positionAttributeLocation);
        gl.vertexAttribPointer(this.positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        this.lastAnimationFrameID = requestAnimationFrame(this.render.bind(this));
    }

    addShaderVar(name, valType, initialVal) {
        if (name in this.shaderVariables) {
            console.error(`Shader variable name already exists: ${name}.`);
            return;
        }
        const loc = this.gl.getUniformLocation(this.program, name);
        this.shaderVariables[name] = [valType, loc, initialVal];
    }

    setShaderVar(name, val) {
        if (!(name in this.shaderVariables)) {
            console.error(`Shader variable name does not exist: ${name}.`);
            return;
        }

        this.shaderVariables[name][2] = val;
    }

    updateShaders(vertexShaderSource, fragmentShaderSource) {
        this.stopShader();
        this.vertexShaderSource = vertexShaderSource;
        this.fragmentShaderSource = fragmentShaderSource;
        this.initShaderProgram();
        this.render();
    }

    startShader() {
        this.stopShader();
        this.render();
    }

    stopShader() {
        if (this.lastAnimationFrameID === -1) return;
        cancelAnimationFrame(this.lastAnimationFrameID);
        this.lastAnimationFrameID = -1;
    }
}
