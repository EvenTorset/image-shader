/// <reference lib="dom"/>

import getWebGLContext from 'gl'

export type ImageDataLike = {
  width: number
  height: number
  data: Uint8ClampedArray | Float32Array
}

export type Uniform = {
  name: string
}

export type UniformFloat = Uniform & {
  type: 'float'
  value: number
}

export type UniformInt = Uniform & {
  type: 'int'
  value: number
}

export type Vec2 = [number, number]
export type Vec3 = [number, number, number]
export type Vec4 = [number, number, number, number]

export type UniformVec2 = Uniform & {
  type: 'vec2'
  value: Vec2
}

export type UniformVec3 = Uniform & {
  type: 'vec3'
  value: Vec3
}

export type UniformVec4 = Uniform & {
  type: 'vec4'
  value: Vec4
}

export type UniformIVec2 = Uniform & {
  type: 'ivec2'
  value: Vec2
}

export type UniformIVec3 = Uniform & {
  type: 'ivec3'
  value: Vec3
}

export type UniformIVec4 = Uniform & {
  type: 'ivec4'
  value: Vec4
}

export type Mat2 = [
  number, number,
  number, number
]

export type Mat3 = [
  number, number, number,
  number, number, number,
  number, number, number
]

export type Mat4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number
]

export type UniformMat2 = Uniform & {
  type: 'mat2'
  value: Mat2
}

export type UniformMat3 = Uniform & {
  type: 'mat3'
  value: Mat3
}

export type UniformMat4 = Uniform & {
  type: 'mat4'
  value: Mat4
}

export type UniformFloatArray = Uniform & {
  type: 'float[]'
  value: number[]
}

export type UniformIntArray = Uniform & {
  type: 'int[]'
  value: number[]
}

export type TextureFilter = 'nearest' | 'linear'
export type TextureWrap = 'clamp' | 'repeat' | 'mirror'

export type UniformTexture = Uniform & {
  type: 'texture'
  value: ImageDataLike
  filter: TextureFilter
  wrap: TextureWrap
}

export type UniformPass = Uniform & {
  type: 'pass'
  value: string
  filter: TextureFilter
  wrap: TextureWrap
}

export type AnyUniform =
  | UniformFloat
  | UniformInt
  | UniformVec2
  | UniformVec3
  | UniformVec4
  | UniformIVec2
  | UniformIVec3
  | UniformIVec4
  | UniformMat2
  | UniformMat3
  | UniformMat4
  | UniformFloatArray
  | UniformIntArray
  | UniformTexture
  | UniformPass

export type Pass = {
  name: string
  uniforms?: AnyUniform[]
  frag: string
  vert?: string
  width: number
  height: number
}

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Failed to create shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || 'Shader compile failed')
  }
  return shader
}

function createShaderProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string): WebGLProgram {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource)
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource)
  const program = gl.createProgram()
  if (!program) throw new Error('Failed to create program')
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'Program link failed')
  }
  return program
}

const defaultVertexShader = /*glsl*/`
  attribute vec2 Position;
  attribute vec2 UV;
  varying vec2 texCoord;

  void main() {
    texCoord = UV;
    gl_Position = vec4(Position, 0.0, 1.0);
  }
`

function renderPass({ width, height, frag, vert, uniforms }: Pass, passResults: Record<string, ImageDataLike>) {
  if (typeof width !== 'number' || Math.floor(width) <= 0 || isNaN(width) || width === Infinity) {
    throw new Error('Invalid width.')
  }
  if (typeof height !== 'number' || Math.floor(height) <= 0 || isNaN(height) || height === Infinity) {
    throw new Error('Invalid height.')
  }
  if (typeof frag !== 'string') {
    throw new Error('Missing or invalid fragment shader.')
  }

  const gl = getWebGLContext(width, height) as WebGLRenderingContext

  const textureFilters: Record<TextureFilter, number> = {
    nearest: gl.NEAREST,
    linear: gl.LINEAR,
  }

  const textureWrapping: Record<TextureWrap, number> = {
    clamp: gl.CLAMP_TO_EDGE,
    repeat: gl.REPEAT,
    mirror: gl.MIRRORED_REPEAT,
  }

  const shaderProgram = createShaderProgram(gl, vert ?? defaultVertexShader, frag)
  gl.useProgram(shaderProgram)

  const vertices = new Float32Array([
    -1.0, -1.0,  0.0,  0.0,
     1.0, -1.0,  1.0,  0.0,
    -1.0,  1.0,  0.0,  1.0,
     1.0,  1.0,  1.0,  1.0
  ])

  const vertexBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

  const posLoc = gl.getAttribLocation(shaderProgram, 'Position')
  const uvLoc = gl.getAttribLocation(shaderProgram, 'UV')

  gl.enableVertexAttribArray(posLoc)
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 0)

  gl.enableVertexAttribArray(uvLoc)
  gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 2 * Float32Array.BYTES_PER_ELEMENT)

  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)

  let textureUnits = 0
  for (const uniform of uniforms ?? []) {
    switch (uniform.type) {
      case 'float': {
        const loc = gl.getUniformLocation(shaderProgram, uniform.name)
        gl.uniform1f(loc, uniform.value)
        break
      }
      case 'int': {
        const loc = gl.getUniformLocation(shaderProgram, uniform.name)
        gl.uniform1i(loc, uniform.value)
        break
      }
      case 'vec2': {
        const loc = gl.getUniformLocation(shaderProgram, uniform.name)
        gl.uniform2f(loc, ...uniform.value)
        break
      }
      case 'vec3': {
        const loc = gl.getUniformLocation(shaderProgram, uniform.name)
        gl.uniform3f(loc, ...uniform.value)
        break
      }
      case 'vec4': {
        const loc = gl.getUniformLocation(shaderProgram, uniform.name)
        gl.uniform4f(loc, ...uniform.value)
        break
      }
      case 'ivec2': {
        const loc = gl.getUniformLocation(shaderProgram, uniform.name)
        gl.uniform2i(loc, ...uniform.value)
        break
      }
      case 'ivec3': {
        const loc = gl.getUniformLocation(shaderProgram, uniform.name)
        gl.uniform3i(loc, ...uniform.value)
        break
      }
      case 'ivec4': {
        const loc = gl.getUniformLocation(shaderProgram, uniform.name)
        gl.uniform4i(loc, ...uniform.value)
        break
      }
      case 'mat2': {
        const loc = gl.getUniformLocation(shaderProgram, uniform.name)
        gl.uniformMatrix2fv(loc, false, uniform.value)
        break
      }
      case 'mat3': {
        const loc = gl.getUniformLocation(shaderProgram, uniform.name)
        gl.uniformMatrix3fv(loc, false, uniform.value)
        break
      }
      case 'mat4': {
        const loc = gl.getUniformLocation(shaderProgram, uniform.name)
        gl.uniformMatrix4fv(loc, false, uniform.value)
        break
      }
      case 'float[]': {
        const loc = gl.getUniformLocation(shaderProgram, uniform.name)
        gl.uniform1fv(loc, new Float32Array(uniform.value))
        break
      }
      case 'int[]': {
        const loc = gl.getUniformLocation(shaderProgram, uniform.name)
        gl.uniform1iv(loc, new Int32Array(uniform.value))
        break
      }
      case 'texture': {
        if (textureUnits >= 8) {
          throw new Error('Too many textures')
        }

        gl.activeTexture(gl[`TEXTURE${textureUnits}`])
        const texture = gl.createTexture()
        if (!texture) {
          throw new Error('Failed to create texture')
        }

        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texImage2D(
          gl.TEXTURE_2D,
          0, gl.RGBA,
          uniform.value.width, uniform.value.height,
          0, gl.RGBA,
          gl.UNSIGNED_BYTE,
          uniform.value.data
        )
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, textureWrapping[uniform.wrap])
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, textureWrapping[uniform.wrap])
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, textureFilters[uniform.filter])
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, textureFilters[uniform.filter])

        const loc = gl.getUniformLocation(shaderProgram, uniform.name)
        gl.uniform1i(loc, textureUnits++)
        break
      }
      case 'pass': {
        if (textureUnits >= 8) {
          throw new Error('Too many textures')
        }

        gl.activeTexture(gl[`TEXTURE${textureUnits}`])
        const texture = gl.createTexture()
        if (!texture) {
          throw new Error('Failed to create texture')
        }

        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texImage2D(
          gl.TEXTURE_2D,
          0, gl.RGBA,
          passResults[uniform.value].width, passResults[uniform.value].height,
          0, gl.RGBA,
          gl.UNSIGNED_BYTE,
          passResults[uniform.value].data
        )
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, textureWrapping[uniform.wrap])
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, textureWrapping[uniform.wrap])
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, textureFilters[uniform.filter])
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, textureFilters[uniform.filter])

        const loc = gl.getUniformLocation(shaderProgram, uniform.name)
        gl.uniform1i(loc, textureUnits++)
        break
      }
      default: {
        //@ts-ignore
        throw new Error(`Invalid uniform type: '${uniform.type}'`)
      }
    }
  }

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

  const pixels = new Uint8Array(width * height * 4)
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

  const ext = gl.getExtension('STACKGL_destroy_context')
  ext.destroy()

  return new Uint8ClampedArray(pixels)
}

export default function render(passes: Pass[]) {
  const passResults: Record<string, ImageDataLike> = {}
  for (const pass of passes) {
    passResults[pass.name] = {
      width: pass.width,
      height: pass.height,
      data: renderPass(pass, passResults)
    }
  }
  return passResults
}
