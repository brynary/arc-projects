import * as THREE from "three"
import { Sky } from "three/examples/jsm/objects/Sky.js"

export type ViewPresetId = "vista" | "tower" | "deck" | "bay"

export const VIEW_PRESETS: Array<{
  id: ViewPresetId
  label: string
  description: string
}> = [
  {
    id: "vista",
    label: "Scenic Vista",
    description: "A broad cinematic flyover with the full bridge and city context.",
  },
  {
    id: "tower",
    label: "Tower Pass",
    description: "A close structural pass that highlights the towers, rivets, and cables.",
  },
  {
    id: "deck",
    label: "Traffic Run",
    description: "A low chase view that runs beside the moving traffic over the roadway.",
  },
  {
    id: "bay",
    label: "Bay Skim",
    description: "A wide low-angle route just above the water looking back at the span.",
  },
]

type Cleanup = () => void

type CarActor = {
  root: THREE.Group
  direction: 1 | -1
  speed: number
  length: number
  laneZ: number
  offset: number
}

type FogActor = {
  sprite: THREE.Sprite
  basePosition: THREE.Vector3
  baseScale: THREE.Vector3
  drift: THREE.Vector3
  phase: number
}

type TransitionState = {
  id: ViewPresetId
  elapsed: number
  duration: number
  fromPosition: THREE.Vector3
  toPosition: THREE.Vector3
  fromQuaternion: THREE.Quaternion
  toQuaternion: THREE.Quaternion
}

type SceneTextures = {
  steel: THREE.Texture
  road: THREE.Texture
  cliff: THREE.Texture
  water: THREE.Texture
}

const FIXED_STEP = 1 / 60
const BRIDGE_HALF_LENGTH = 1368
const TOWER_X = 640
const ROAD_Y = 67
const DECK_WIDTH = 31
const WATER_LEVEL = 0
const WORLD_BOUND = 4200
const UP = new THREE.Vector3(0, 1, 0)
const TEMP_A = new THREE.Vector3()
const TEMP_B = new THREE.Vector3()
const TEMP_C = new THREE.Vector3()
const TEMP_Q = new THREE.Quaternion()
const LOOK_MATRIX = new THREE.Matrix4()
const EULER = new THREE.Euler(0, 0, 0, "YXZ")
const SUN_ELEVATION = 12
const SUN_AZIMUTH = 123

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return x * x * (3 - 2 * x)
}

function seededNoise(seed: number) {
  const x = Math.sin(seed * 127.1) * 43758.5453123
  return x - Math.floor(x)
}

function makeFogTexture() {
  const canvas = document.createElement("canvas")
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    const texture = new THREE.Texture()
    texture.needsUpdate = true
    return texture
  }

  const gradient = ctx.createRadialGradient(256, 256, 30, 256, 256, 240)
  gradient.addColorStop(0, "rgba(255,255,255,0.82)")
  gradient.addColorStop(0.36, "rgba(255,255,255,0.42)")
  gradient.addColorStop(0.7, "rgba(255,255,255,0.12)")
  gradient.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (let i = 0; i < 32; i += 1) {
    const alpha = 0.02 + seededNoise(i + 91) * 0.05
    ctx.fillStyle = `rgba(255,255,255,${alpha})`
    const x = seededNoise(i + 1) * canvas.width
    const y = seededNoise(i + 11) * canvas.height
    const r = 50 + seededNoise(i + 31) * 120
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function configureTexture(texture: THREE.Texture, repeatX: number, repeatY: number) {
  texture.wrapS = THREE.MirroredRepeatWrapping
  texture.wrapT = THREE.MirroredRepeatWrapping
  texture.repeat.set(repeatX, repeatY)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.needsUpdate = true
}

function makeLookQuaternion(position: THREE.Vector3, lookAt: THREE.Vector3) {
  LOOK_MATRIX.lookAt(position, lookAt, UP)
  return new THREE.Quaternion().setFromRotationMatrix(LOOK_MATRIX)
}

function createLaneStripe(length: number, z: number) {
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.08, 0.28),
    new THREE.MeshBasicMaterial({ color: 0xf1e7c4, toneMapped: false }),
  )
  stripe.position.set(0, ROAD_Y + 2.1, z)
  return stripe
}

function createCableCurve(zOffset: number) {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1240, 108, zOffset),
    new THREE.Vector3(-935, 173, zOffset),
    new THREE.Vector3(-TOWER_X, 227, zOffset),
    new THREE.Vector3(0, 142, zOffset),
    new THREE.Vector3(TOWER_X, 227, zOffset),
    new THREE.Vector3(935, 173, zOffset),
    new THREE.Vector3(1240, 108, zOffset),
  ])
}

function sampleCurveAtX(curve: THREE.CatmullRomCurve3, x: number) {
  let closestPoint = curve.getPoint(0)
  let closestDistance = Number.POSITIVE_INFINITY
  for (let i = 0; i <= 300; i += 1) {
    const point = curve.getPoint(i / 300)
    const distance = Math.abs(point.x - x)
    if (distance < closestDistance) {
      closestDistance = distance
      closestPoint = point
    }
  }
  return closestPoint
}

function makeWindowTexture() {
  const canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 512
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    const texture = new THREE.Texture()
    texture.needsUpdate = true
    return texture
  }

  ctx.fillStyle = "#1f2d40"
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (let row = 0; row < 24; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const lit = seededNoise(row * 17 + col * 13 + 9) > 0.22
      ctx.fillStyle = lit ? "rgba(255, 219, 166, 0.95)" : "rgba(33, 48, 69, 0.95)"
      ctx.fillRect(12 + col * 26, 10 + row * 21, 15, 11)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1, 1)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeWaterMaterial(texture: THREE.Texture, fogColor: THREE.Color, fogDensity: number) {
  return new THREE.ShaderMaterial({
    transparent: false,
    fog: false,
    uniforms: {
      time: { value: 0 },
      waterMap: { value: texture },
      sunDirection: { value: new THREE.Vector3(0.75, 0.48, 0.34).normalize() },
      fogColor: { value: fogColor.clone() },
      fogDensity: { value: fogDensity },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform sampler2D waterMap;
      uniform vec3 sunDirection;
      uniform vec3 fogColor;
      uniform float fogDensity;

      varying vec2 vUv;
      varying vec3 vWorldPosition;

      float waveHeight(vec2 p) {
        float h = 0.0;
        h += sin(p.x * 0.010 + time * 0.42) * 0.65;
        h += cos(p.y * 0.013 - time * 0.35) * 0.45;
        h += sin((p.x + p.y) * 0.018 + time * 0.21) * 0.22;
        return h;
      }

      vec3 waveNormal(vec2 p) {
        float e = 2.0;
        float h = waveHeight(p);
        float hx = waveHeight(p + vec2(e, 0.0));
        float hy = waveHeight(p + vec2(0.0, e));
        return normalize(vec3(h - hx, e * 0.65, h - hy));
      }

      void main() {
        vec2 p = vWorldPosition.xz;
        vec3 normal = waveNormal(p);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.0);
        float diffuse = max(dot(normal, normalize(sunDirection)), 0.0);

        vec2 uvA = vUv * vec2(12.0, 9.0) + vec2(time * 0.012, -time * 0.008);
        vec2 uvB = vUv * vec2(21.0, 15.0) + vec2(-time * 0.006, time * 0.011);
        vec3 texA = texture2D(waterMap, uvA).rgb;
        vec3 texB = texture2D(waterMap, uvB).rgb;

        vec3 baseColor = mix(vec3(0.03, 0.16, 0.22), vec3(0.11, 0.35, 0.43), texA.b * 0.55 + texB.g * 0.45);
        float sparkle = pow(max(dot(reflect(-normalize(sunDirection), normal), viewDir), 0.0), 90.0);
        vec3 color = baseColor * (0.45 + diffuse * 0.85);
        color += vec3(1.0, 0.88, 0.68) * sparkle * 1.6;
        color += fresnel * vec3(0.42, 0.71, 0.95) * 0.9;

        float depth = length(cameraPosition.xz - vWorldPosition.xz) * 0.00038 + max(0.0, 20.0 - cameraPosition.y) * 0.0005;
        float fogFactor = 1.0 - exp2(-fogDensity * fogDensity * depth * depth * 1200.0);
        color = mix(color, fogColor, clamp(fogFactor, 0.0, 1.0));

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  })
}

function createSteelMaterial(texture: THREE.Texture) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xe26b48,
    roughness: 0.53,
    metalness: 0.47,
  })
}

function createRoadMaterial(texture: THREE.Texture) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    color: 0x53555d,
    roughness: 0.92,
    metalness: 0.04,
  })
}

function createTerrainMaterial(texture: THREE.Texture) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    color: 0x93806a,
    roughness: 1,
    metalness: 0,
  })
}

function buildTower(material: THREE.Material) {
  const tower = new THREE.Group()
  const legWidth = 10
  const legDepth = 7
  const legGap = 21
  const towerTop = 227

  const legGeometry = new THREE.BoxGeometry(legWidth, towerTop, legDepth)
  const leftLeg = new THREE.Mesh(legGeometry, material)
  const rightLeg = new THREE.Mesh(legGeometry, material)
  leftLeg.castShadow = true
  leftLeg.receiveShadow = true
  rightLeg.castShadow = true
  rightLeg.receiveShadow = true
  leftLeg.position.set(0, towerTop / 2, -legGap / 2)
  rightLeg.position.set(0, towerTop / 2, legGap / 2)
  tower.add(leftLeg, rightLeg)

  const crossBeamHeights = [34, 82, 130, 178, 215]
  for (const y of crossBeamHeights) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(8, 5, legGap + 7), material)
    beam.position.set(0, y, 0)
    beam.castShadow = true
    beam.receiveShadow = true
    tower.add(beam)
  }

  const topCap = new THREE.Mesh(new THREE.BoxGeometry(12, 8, legGap + 10), material)
  topCap.position.set(0, towerTop + 3, 0)
  topCap.castShadow = true
  topCap.receiveShadow = true
  tower.add(topCap)

  for (let i = 0; i < 9; i += 1) {
    const y = 18 + i * 22
    const braceA = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 28), material)
    braceA.position.set(0, y, 0)
    braceA.rotation.x = Math.PI / 5.8
    braceA.castShadow = true
    braceA.receiveShadow = true
    const braceB = braceA.clone()
    braceB.rotation.x = -Math.PI / 5.8
    tower.add(braceA, braceB)
  }

  return tower
}

function createTerrainMesh(
  width: number,
  depth: number,
  segments: number,
  material: THREE.Material,
  worldOffset: THREE.Vector3,
  heightFn: (worldX: number, worldZ: number) => number,
) {
  const geometry = new THREE.PlaneGeometry(width, depth, segments, segments)
  geometry.rotateX(-Math.PI / 2)
  const positions = geometry.attributes.position

  for (let i = 0; i < positions.count; i += 1) {
    const localX = positions.getX(i)
    const localZ = positions.getZ(i)
    const worldX = localX + worldOffset.x
    const worldZ = localZ + worldOffset.z
    const height = heightFn(worldX, worldZ)
    positions.setY(i, height)
  }

  geometry.computeVertexNormals()

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.copy(worldOffset)
  mesh.receiveShadow = true
  mesh.castShadow = false
  return mesh
}

function createCar(index: number) {
  const root = new THREE.Group()
  const colors = [0xc8d3de, 0x6ba0d4, 0xbf3131, 0xf0e7db, 0x375164, 0x1f1f22]
  const paint = colors[index % colors.length]

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 2.2, 3.2),
    new THREE.MeshStandardMaterial({ color: paint, roughness: 0.42, metalness: 0.32 }),
  )
  body.castShadow = true
  body.receiveShadow = true
  body.position.y = 1.9

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 1.6, 2.7),
    new THREE.MeshStandardMaterial({ color: 0xd9e5ef, roughness: 0.16, metalness: 0.12, opacity: 0.82, transparent: true }),
  )
  cabin.position.set(-0.2, 3.2, 0)
  cabin.castShadow = true

  const headlightMaterial = new THREE.MeshBasicMaterial({ color: 0xfff5da, toneMapped: false })
  const taillightMaterial = new THREE.MeshBasicMaterial({ color: 0xff5c4f, toneMapped: false })
  const lightGeometry = new THREE.BoxGeometry(0.25, 0.2, 0.6)

  const headlights = [-1, 1].map((sign) => {
    const light = new THREE.Mesh(lightGeometry, headlightMaterial)
    light.position.set(4.2, 1.8, sign * 1.15)
    return light
  })

  const taillights = [-1, 1].map((sign) => {
    const light = new THREE.Mesh(lightGeometry, taillightMaterial)
    light.position.set(-4.2, 1.7, sign * 1.15)
    return light
  })

  const wheelGeometry = new THREE.CylinderGeometry(0.68, 0.68, 0.7, 18)
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.94, metalness: 0.12 })
  const wheelPositions = [
    [2.6, 0.7, -1.5],
    [2.6, 0.7, 1.5],
    [-2.6, 0.7, -1.5],
    [-2.6, 0.7, 1.5],
  ] as const
  const wheels = wheelPositions.map(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial)
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(x, y, z)
    wheel.castShadow = true
    return wheel
  })

  root.add(body, cabin, ...headlights, ...taillights, ...wheels)
  return root
}

function updateEulerFromQuaternion(quaternion: THREE.Quaternion) {
  EULER.setFromQuaternion(quaternion, "YXZ")
  return { yaw: EULER.y, pitch: EULER.x }
}

const PRESET_CAMERA_TARGETS: Record<
  ViewPresetId,
  { position: THREE.Vector3; lookAt: THREE.Vector3; speed: number }
> = {
  vista: {
    position: new THREE.Vector3(1580, 290, 980),
    lookAt: new THREE.Vector3(140, 104, -80),
    speed: 76,
  },
  tower: {
    position: new THREE.Vector3(-430, 188, 96),
    lookAt: new THREE.Vector3(-640, 170, 0),
    speed: 42,
  },
  deck: {
    position: new THREE.Vector3(-1120, 93, -26),
    lookAt: new THREE.Vector3(-540, 75, -12),
    speed: 50,
  },
  bay: {
    position: new THREE.Vector3(940, 38, -520),
    lookAt: new THREE.Vector3(90, 100, -20),
    speed: 68,
  },
}

export class GoldenGateFlightExperience {
  private container: HTMLDivElement
  private scene: THREE.Scene
  private renderer: THREE.WebGLRenderer
  private camera: THREE.PerspectiveCamera
  private cleanupFns: Cleanup[] = []
  private textures: SceneTextures
  private pmremGenerator: THREE.PMREMGenerator
  private sky: Sky
  private sunLight: THREE.DirectionalLight
  private hemisphereLight: THREE.HemisphereLight
  private waterMaterial: THREE.ShaderMaterial
  private cars: CarActor[] = []
  private fogActors: FogActor[] = []
  private waterPlane: THREE.Mesh
  private clock = new THREE.Clock()
  private rafId = 0
  private disposed = false
  private keys = new Set<string>()
  private pointerDragging = false
  private activeView: ViewPresetId = "vista"
  private transition: TransitionState | null = null
  private yaw = -0.98
  private pitch = -0.18
  private lookSensitivity = 0.0035
  private flightSpeed = PRESET_CAMERA_TARGETS.vista.speed
  private velocity = new THREE.Vector3(0, 0, 0)
  private time = 0
  private manualInputThisFrame = false

  constructor(container: HTMLDivElement) {
    this.container = container
    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.FogExp2(new THREE.Color(0xccd8e6), 0.00058)

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.12
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.domElement.style.width = "100%"
    this.renderer.domElement.style.height = "100%"
    this.renderer.domElement.style.display = "block"
    this.container.appendChild(this.renderer.domElement)

    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer)
    this.pmremGenerator.compileEquirectangularShader()

    this.textures = this.loadTextures()
    this.sky = this.createSky()
    this.scene.add(this.sky)

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 25000)
    this.sunLight = this.createSunLight()
    this.hemisphereLight = new THREE.HemisphereLight(0xd7ebff, 0x46372c, 2.6)
    this.scene.add(this.hemisphereLight, this.sunLight)

    this.waterMaterial = makeWaterMaterial(
      this.textures.water,
      (this.scene.fog as THREE.FogExp2).color,
      (this.scene.fog as THREE.FogExp2).density,
    )
    this.waterMaterial.uniforms.sunDirection.value.copy(this.sunLight.position).normalize()
    this.waterPlane = this.createWaterPlane()

    this.buildWorld()
    this.bindEvents()
    this.resize()
    this.setViewPreset("vista", true)
    this.installTestingHooks()
    this.render()
    this.startLoop()
  }

  get canvas() {
    return this.renderer.domElement
  }

  get currentView() {
    return this.activeView
  }

  dispose() {
    this.disposed = true
    window.cancelAnimationFrame(this.rafId)

    for (const cleanup of this.cleanupFns) cleanup()
    this.cleanupFns = []

    this.renderer.dispose()
    this.pmremGenerator.dispose()
    this.waterMaterial.dispose()
    Object.values(this.textures).forEach((texture) => texture.dispose())

    if (window.render_game_to_text) delete window.render_game_to_text
    if (window.advanceTime) delete window.advanceTime

    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement)
    }
  }

  toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
      return
    }
    void this.container.requestFullscreen?.()
  }

  setViewPreset(id: ViewPresetId, instant = false) {
    const preset = PRESET_CAMERA_TARGETS[id]
    this.activeView = id
    this.flightSpeed = preset.speed

    const toQuaternion = makeLookQuaternion(preset.position, preset.lookAt)
    if (instant) {
      this.camera.position.copy(preset.position)
      this.camera.quaternion.copy(toQuaternion)
      const nextAngles = updateEulerFromQuaternion(this.camera.quaternion)
      this.yaw = nextAngles.yaw
      this.pitch = nextAngles.pitch
      this.transition = null
      this.velocity.set(0, 0, 0)
      this.render()
      return
    }

    this.transition = {
      id,
      elapsed: 0,
      duration: 1.5,
      fromPosition: this.camera.position.clone(),
      toPosition: preset.position.clone(),
      fromQuaternion: this.camera.quaternion.clone(),
      toQuaternion,
    }
  }

  advanceTime(ms: number) {
    const steps = Math.max(1, Math.round(ms / (FIXED_STEP * 1000)))
    for (let i = 0; i < steps; i += 1) {
      this.step(FIXED_STEP)
    }
    this.render()
  }

  private loadTextures() {
    const loader = new THREE.TextureLoader()
    const steel = loader.load("/textures/bridge-steel.png")
    const road = loader.load("/textures/road-asphalt.png")
    const cliff = loader.load("/textures/coast-cliff.png")
    const water = loader.load("/textures/bay-water.png")

    configureTexture(steel, 1.3, 5)
    configureTexture(road, 12, 2.5)
    configureTexture(cliff, 4, 4)
    configureTexture(water, 3, 3)

    return { steel, road, cliff, water }
  }

  private createSky() {
    const sky = new Sky()
    sky.scale.setScalar(450000)
    sky.material.uniforms.turbidity.value = 8.6
    sky.material.uniforms.rayleigh.value = 1.35
    sky.material.uniforms.mieCoefficient.value = 0.008
    sky.material.uniforms.mieDirectionalG.value = 0.93

    const sun = new THREE.Vector3()
    const phi = THREE.MathUtils.degToRad(90 - SUN_ELEVATION)
    const theta = THREE.MathUtils.degToRad(SUN_AZIMUTH)
    sun.setFromSphericalCoords(1, phi, theta)
    sky.material.uniforms.sunPosition.value.copy(sun)

    const envScene = new THREE.Scene()
    envScene.add(sky.clone())
    const envRT = this.pmremGenerator.fromScene(envScene)
    this.scene.environment = envRT.texture
    return sky
  }

  private createSunLight() {
    const sun = new THREE.DirectionalLight(0xffdfbc, 4.6)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.bias = -0.00012
    sun.shadow.normalBias = 0.05
    sun.shadow.camera.near = 50
    sun.shadow.camera.far = 4500
    sun.shadow.camera.left = -950
    sun.shadow.camera.right = 950
    sun.shadow.camera.top = 780
    sun.shadow.camera.bottom = -620

    const phi = THREE.MathUtils.degToRad(90 - SUN_ELEVATION)
    const theta = THREE.MathUtils.degToRad(SUN_AZIMUTH)
    const sunVector = new THREE.Vector3().setFromSphericalCoords(2200, phi, theta)
    sun.position.copy(sunVector)
    this.waterMaterial?.uniforms.sunDirection.value.copy(sun.position).normalize()
    return sun
  }

  private createWaterPlane() {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000, 1, 1), this.waterMaterial)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = WATER_LEVEL
    mesh.receiveShadow = true
    return mesh
  }

  private buildWorld() {
    this.scene.add(this.waterPlane)
    this.buildTerrain()
    this.buildBridge()
    this.buildCityBackdrop()
    this.buildFogBanks()
  }

  private buildTerrain() {
    const terrainMaterial = createTerrainMaterial(this.textures.cliff)

    const westTerrain = createTerrainMesh(
      2400,
      3000,
      150,
      terrainMaterial,
      new THREE.Vector3(-2100, 0, 0),
      (worldX, worldZ) => {
        const shoreline = smoothstep(-1240, -720, worldX)
        const ridge = smoothstep(-1600, -3300, worldX)
        const zBands = 0.55 + 0.45 * Math.sin(worldZ * 0.004 + 0.8)
        const roughness = Math.sin(worldZ * 0.011) * 18 + Math.cos(worldX * 0.009 + worldZ * 0.004) * 14
        return 18 + shoreline * 150 + ridge * 210 * zBands + roughness
      },
    )

    const eastTerrain = createTerrainMesh(
      2600,
      3200,
      160,
      terrainMaterial.clone(),
      new THREE.Vector3(2120, 0, 0),
      (worldX, worldZ) => {
        const shoreline = smoothstep(1240, 720, worldX)
        const hill = smoothstep(1700, 3100, worldX)
        const parkFold = 0.45 + 0.55 * Math.cos(worldZ * 0.0032 - 0.9)
        const undulation = Math.sin(worldZ * 0.008) * 12 + Math.cos(worldX * 0.007 + worldZ * 0.0025) * 14
        return 16 + shoreline * 105 + hill * 175 * parkFold + undulation
      },
    )

    const island = createTerrainMesh(
      500,
      380,
      44,
      terrainMaterial.clone(),
      new THREE.Vector3(540, 0, 610),
      (worldX, worldZ) => {
        const radial = Math.max(0, 1 - Math.hypot(worldX - 540, worldZ - 610) / 250)
        const lobe = 0.8 + 0.2 * Math.sin(worldZ * 0.02)
        return 4 + radial * 62 * lobe
      },
    )

    this.scene.add(westTerrain, eastTerrain, island)
  }

  private buildBridge() {
    const bridge = new THREE.Group()
    const steelMaterial = createSteelMaterial(this.textures.steel)
    const cableMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4a3d, roughness: 0.46, metalness: 0.64 })
    const roadMaterial = createRoadMaterial(this.textures.road)
    const underDeckMaterial = new THREE.MeshStandardMaterial({ color: 0x90462f, roughness: 0.57, metalness: 0.41 })

    const deck = new THREE.Mesh(new THREE.BoxGeometry(BRIDGE_HALF_LENGTH * 2, 4, DECK_WIDTH), roadMaterial)
    deck.position.set(0, ROAD_Y, 0)
    deck.castShadow = true
    deck.receiveShadow = true
    bridge.add(deck)

    const trussLeft = new THREE.Mesh(new THREE.BoxGeometry(BRIDGE_HALF_LENGTH * 2, 11, 2.8), underDeckMaterial)
    const trussRight = trussLeft.clone()
    trussLeft.position.set(0, ROAD_Y - 3.2, -DECK_WIDTH / 2 - 1)
    trussRight.position.set(0, ROAD_Y - 3.2, DECK_WIDTH / 2 + 1)
    trussLeft.castShadow = true
    trussRight.castShadow = true
    trussLeft.receiveShadow = true
    trussRight.receiveShadow = true
    bridge.add(trussLeft, trussRight)

    for (let x = -BRIDGE_HALF_LENGTH + 22; x < BRIDGE_HALF_LENGTH - 10; x += 36) {
      const crossMember = new THREE.Mesh(new THREE.BoxGeometry(2.1, 8, DECK_WIDTH + 5.5), steelMaterial)
      crossMember.position.set(x, ROAD_Y - 2.8, 0)
      crossMember.castShadow = true
      crossMember.receiveShadow = true
      bridge.add(crossMember)
    }

    const railingGeometry = new THREE.BoxGeometry(BRIDGE_HALF_LENGTH * 2, 1.5, 0.35)
    const railingLeft = new THREE.Mesh(railingGeometry, steelMaterial)
    const railingRight = railingLeft.clone()
    railingLeft.position.set(0, ROAD_Y + 4.6, -DECK_WIDTH / 2 + 1.1)
    railingRight.position.set(0, ROAD_Y + 4.6, DECK_WIDTH / 2 - 1.1)
    bridge.add(railingLeft, railingRight)

    for (let x = -BRIDGE_HALF_LENGTH + 18; x < BRIDGE_HALF_LENGTH - 18; x += 18) {
      const postLeft = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 0.4), steelMaterial)
      const postRight = postLeft.clone()
      postLeft.position.set(x, ROAD_Y + 3.3, -DECK_WIDTH / 2 + 1.1)
      postRight.position.set(x, ROAD_Y + 3.3, DECK_WIDTH / 2 - 1.1)
      bridge.add(postLeft, postRight)
    }

    for (let x = -BRIDGE_HALF_LENGTH + 32; x < BRIDGE_HALF_LENGTH - 25; x += 46) {
      const stripeLength = Math.min(22, BRIDGE_HALF_LENGTH - Math.abs(x) - 12)
      if (stripeLength > 8) bridge.add(createLaneStripe(stripeLength, 0))
    }

    const towers = [
      buildTower(steelMaterial),
      buildTower(steelMaterial),
    ]
    towers[0].position.set(-TOWER_X, 0, 0)
    towers[1].position.set(TOWER_X, 0, 0)
    bridge.add(...towers)

    const towerFootprint = new THREE.Mesh(new THREE.BoxGeometry(46, 12, 42), steelMaterial)
    const westFootprint = towerFootprint.clone()
    const eastFootprint = towerFootprint.clone()
    westFootprint.position.set(-TOWER_X, 6, 0)
    eastFootprint.position.set(TOWER_X, 6, 0)
    bridge.add(westFootprint, eastFootprint)

    const anchorMaterial = new THREE.MeshStandardMaterial({ color: 0x90755f, roughness: 0.84, metalness: 0.06 })
    const westAnchor = new THREE.Mesh(new THREE.BoxGeometry(95, 62, 84), anchorMaterial)
    const eastAnchor = westAnchor.clone()
    westAnchor.position.set(-1290, 45, 0)
    eastAnchor.position.set(1290, 45, 0)
    bridge.add(westAnchor, eastAnchor)

    const cableOffsets = [-14.4, 14.4]
    for (const zOffset of cableOffsets) {
      const curve = createCableCurve(zOffset)
      const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 180, 1.65, 18, false), cableMaterial)
      cable.castShadow = true
      cable.receiveShadow = true
      bridge.add(cable)

      for (let x = -1160; x <= 1160; x += 30) {
        const sample = sampleCurveAtX(curve, x)
        const drop = Math.max(6, sample.y - (ROAD_Y + 4))
        const suspender = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, drop, 8), cableMaterial)
        suspender.position.set(x, ROAD_Y + 4 + drop / 2, zOffset)
        suspender.castShadow = true
        bridge.add(suspender)
      }
    }

    const sideCableGeometry = new THREE.CylinderGeometry(1.2, 1.2, 630, 16)
    const westSideCableA = new THREE.Mesh(sideCableGeometry, cableMaterial)
    westSideCableA.position.set(-951, 165, -14.4)
    westSideCableA.rotation.z = -Math.PI / 3.7
    const westSideCableB = westSideCableA.clone()
    westSideCableB.position.z = 14.4
    const eastSideCableA = westSideCableA.clone()
    eastSideCableA.position.set(951, 165, -14.4)
    eastSideCableA.rotation.z = Math.PI / 3.7
    const eastSideCableB = eastSideCableA.clone()
    eastSideCableB.position.z = 14.4
    bridge.add(westSideCableA, westSideCableB, eastSideCableA, eastSideCableB)

    this.scene.add(bridge)
    this.buildTraffic(bridge)
  }

  private buildTraffic(parent: THREE.Object3D) {
    const laneConfig = [
      { laneZ: -8.1, direction: 1 as const, baseSpeed: 28 },
      { laneZ: -4.1, direction: 1 as const, baseSpeed: 33 },
      { laneZ: 4.1, direction: -1 as const, baseSpeed: 31 },
      { laneZ: 8.1, direction: -1 as const, baseSpeed: 26 },
    ]

    let carIndex = 0
    for (const lane of laneConfig) {
      for (let i = 0; i < 7; i += 1) {
        const root = createCar(carIndex)
        const offset = -BRIDGE_HALF_LENGTH + i * 380 + seededNoise(carIndex * 11 + 7) * 110
        const speed = lane.baseSpeed + seededNoise(carIndex * 3 + 19) * 8
        root.position.set(offset, ROAD_Y + 2.4, lane.laneZ)
        if (lane.direction === -1) root.rotation.y = Math.PI
        parent.add(root)

        this.cars.push({
          root,
          direction: lane.direction,
          speed,
          length: 2 * BRIDGE_HALF_LENGTH + 160,
          laneZ: lane.laneZ,
          offset,
        })

        carIndex += 1
      }
    }
  }

  private buildCityBackdrop() {
    const buildingTexture = makeWindowTexture()
    const buildingMaterial = new THREE.MeshStandardMaterial({
      color: 0x55606d,
      emissive: 0x162534,
      emissiveIntensity: 0.8,
      map: buildingTexture,
      roughness: 0.83,
      metalness: 0.05,
    })

    const district = new THREE.Group()
    for (let i = 0; i < 72; i += 1) {
      const width = 28 + seededNoise(i * 17 + 7) * 36
      const depth = 30 + seededNoise(i * 13 + 9) * 40
      const height = 35 + seededNoise(i * 29 + 3) * 210
      const x = 1320 + seededNoise(i * 11 + 1) * 1220
      const z = -1350 + seededNoise(i * 19 + 5) * 2500
      const keepBack = Math.abs(z) > 140 || x > 1480
      if (!keepBack) continue

      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), buildingMaterial.clone())
      const tone = 0.82 + seededNoise(i * 5 + 31) * 0.28
      ;(mesh.material as THREE.MeshStandardMaterial).color.multiplyScalar(tone)
      ;(mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.42 + seededNoise(i * 2 + 4) * 0.5
      mesh.position.set(x, height / 2 + 16, z)
      mesh.castShadow = false
      mesh.receiveShadow = true
      district.add(mesh)
    }

    const pyramid = new THREE.Mesh(
      new THREE.ConeGeometry(52, 240, 4),
      new THREE.MeshStandardMaterial({ color: 0xc7d4df, emissive: 0x2f4d63, emissiveIntensity: 0.55, roughness: 0.48, metalness: 0.28 }),
    )
    pyramid.position.set(1940, 136, -470)
    pyramid.rotation.y = Math.PI / 4

    const coitLike = new THREE.Mesh(
      new THREE.CylinderGeometry(20, 24, 120, 18),
      new THREE.MeshStandardMaterial({ color: 0xdddbc8, roughness: 0.76, metalness: 0.05 }),
    )
    coitLike.position.set(1360, 95, 520)

    district.add(pyramid, coitLike)
    this.scene.add(district)
  }

  private buildFogBanks() {
    const texture = makeFogTexture()
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: 0xf1f5fb,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    })

    const fogDefinitions = [
      { position: new THREE.Vector3(-1040, 82, -120), scale: [470, 180], drift: [12, 0, 7] },
      { position: new THREE.Vector3(-680, 112, 150), scale: [360, 140], drift: [-8, 0, 12] },
      { position: new THREE.Vector3(640, 90, -200), scale: [420, 170], drift: [10, 0, -6] },
      { position: new THREE.Vector3(1180, 58, 280), scale: [640, 210], drift: [-6, 0, -8] },
      { position: new THREE.Vector3(140, 44, -520), scale: [720, 160], drift: [5, 0, 4] },
      { position: new THREE.Vector3(-300, 54, 520), scale: [540, 170], drift: [4, 0, -5] },
    ]

    fogDefinitions.forEach((definition, index) => {
      const sprite = new THREE.Sprite(material.clone())
      sprite.position.copy(definition.position)
      sprite.scale.set(definition.scale[0], definition.scale[1], 1)
      this.scene.add(sprite)
      this.fogActors.push({
        sprite,
        basePosition: definition.position.clone(),
        baseScale: sprite.scale.clone(),
        drift: new THREE.Vector3(definition.drift[0], definition.drift[1], definition.drift[2]),
        phase: index * 1.7,
      })
    })
  }

  private bindEvents() {
    const onResize = () => this.resize()
    const onKeyDown = (event: KeyboardEvent) => {
      this.keys.add(event.code)
      this.manualInputThisFrame = true

      if (event.code === "Digit1") this.setViewPreset("vista")
      if (event.code === "Digit2") this.setViewPreset("tower")
      if (event.code === "Digit3") this.setViewPreset("deck")
      if (event.code === "Digit4") this.setViewPreset("bay")
      if (event.code === "KeyF") this.toggleFullscreen()
    }
    const onKeyUp = (event: KeyboardEvent) => {
      this.keys.delete(event.code)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      this.pointerDragging = true
      this.renderer.domElement.setPointerCapture?.(event.pointerId)
    }
    const onPointerUp = (event: PointerEvent) => {
      this.pointerDragging = false
      this.renderer.domElement.releasePointerCapture?.(event.pointerId)
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!this.pointerDragging) return
      this.manualInputThisFrame = true
      this.cancelTransition()
      this.yaw -= event.movementX * this.lookSensitivity
      this.pitch = clamp(this.pitch - event.movementY * this.lookSensitivity, -1.18, 1.18)
    }
    const onWheel = (event: WheelEvent) => {
      this.flightSpeed = clamp(this.flightSpeed + Math.sign(-event.deltaY) * 5, 18, 140)
    }
    const onVisibility = () => {
      if (document.hidden) this.clock.stop()
      else this.clock.start()
    }
    const onFullscreenChange = () => this.resize()

    window.addEventListener("resize", onResize)
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    document.addEventListener("visibilitychange", onVisibility)
    document.addEventListener("fullscreenchange", onFullscreenChange)
    this.renderer.domElement.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("pointerup", onPointerUp)
    window.addEventListener("pointermove", onPointerMove)
    this.renderer.domElement.addEventListener("wheel", onWheel, { passive: true })

    this.cleanupFns.push(
      () => window.removeEventListener("resize", onResize),
      () => window.removeEventListener("keydown", onKeyDown),
      () => window.removeEventListener("keyup", onKeyUp),
      () => document.removeEventListener("visibilitychange", onVisibility),
      () => document.removeEventListener("fullscreenchange", onFullscreenChange),
      () => this.renderer.domElement.removeEventListener("pointerdown", onPointerDown),
      () => window.removeEventListener("pointerup", onPointerUp),
      () => window.removeEventListener("pointermove", onPointerMove),
      () => this.renderer.domElement.removeEventListener("wheel", onWheel),
    )
  }

  private installTestingHooks() {
    window.render_game_to_text = () => {
      const direction = new THREE.Vector3()
      this.camera.getWorldDirection(direction)
      const payload = {
        mode: "flight",
        view: this.activeView,
        coordinate_system:
          "meters in a bridge-centered world; x runs west(-) to east(+ ) across the Golden Gate span, y is altitude above bay water, z runs south(-) to north(+) along the strait",
        camera: {
          position: {
            x: Number(this.camera.position.x.toFixed(1)),
            y: Number(this.camera.position.y.toFixed(1)),
            z: Number(this.camera.position.z.toFixed(1)),
          },
          look_direction: {
            x: Number(direction.x.toFixed(3)),
            y: Number(direction.y.toFixed(3)),
            z: Number(direction.z.toFixed(3)),
          },
          yaw: Number(this.yaw.toFixed(3)),
          pitch: Number(this.pitch.toFixed(3)),
          speed: Number(this.flightSpeed.toFixed(1)),
        },
        bridge: {
          roadway_altitude_m: ROAD_Y,
          tower_positions: [
            { x: -TOWER_X, y: 227, z: 0 },
            { x: TOWER_X, y: 227, z: 0 },
          ],
          traffic_count: this.cars.length,
        },
        nearby_traffic: this.cars.slice(0, 8).map((car) => ({
          x: Number(car.root.position.x.toFixed(1)),
          y: Number(car.root.position.y.toFixed(1)),
          z: Number(car.root.position.z.toFixed(1)),
          direction: car.direction,
        })),
        atmosphere: {
          fog_density: (this.scene.fog as THREE.FogExp2).density,
          sun_elevation_deg: SUN_ELEVATION,
          sun_azimuth_deg: SUN_AZIMUTH,
        },
        controls: {
          keyboard: [
            "W/S or ArrowUp/ArrowDown = forward/reverse",
            "A/D = strafe",
            "ArrowLeft/ArrowRight = yaw",
            "Space/E = ascend",
            "B/Q/Shift = descend",
            "1-4 = viewpoints",
            "F = fullscreen",
          ],
          mouse: ["drag = look", "wheel = tune cruise speed"],
        },
      }
      return JSON.stringify(payload)
    }

    window.advanceTime = async (ms: number) => {
      this.advanceTime(ms)
    }
  }

  private resize() {
    const bounds = this.container.getBoundingClientRect()
    const width = Math.max(1, Math.floor(bounds.width))
    const height = Math.max(1, Math.floor(bounds.height))
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(width, height, false)
    this.render()
  }

  private startLoop() {
    this.clock.start()
    const tick = () => {
      if (this.disposed) return
      const delta = clamp(this.clock.getDelta(), 0.001, 0.05)
      this.step(delta)
      this.render()
      this.rafId = window.requestAnimationFrame(tick)
    }
    this.rafId = window.requestAnimationFrame(tick)
  }

  private step(delta: number) {
    this.time += delta
    this.manualInputThisFrame = false

    if (this.transition) {
      this.transition.elapsed += delta
      const t = smoothstep(0, 1, this.transition.elapsed / this.transition.duration)
      this.camera.position.lerpVectors(this.transition.fromPosition, this.transition.toPosition, t)
      TEMP_Q.slerpQuaternions(this.transition.fromQuaternion, this.transition.toQuaternion, t)
      this.camera.quaternion.copy(TEMP_Q)
      const nextAngles = updateEulerFromQuaternion(this.camera.quaternion)
      this.yaw = nextAngles.yaw
      this.pitch = nextAngles.pitch
      if (this.transition.elapsed >= this.transition.duration) {
        this.transition = null
      }
    }

    this.updateFlight(delta)
    this.updateCars(delta)
    this.updateFog(delta)
    this.waterMaterial.uniforms.time.value = this.time
  }

  private updateFlight(delta: number) {
    const input = {
      forward: this.keys.has("KeyW") || this.keys.has("ArrowUp"),
      backward: this.keys.has("KeyS") || this.keys.has("ArrowDown"),
      strafeLeft: this.keys.has("KeyA"),
      strafeRight: this.keys.has("KeyD"),
      yawLeft: this.keys.has("ArrowLeft"),
      yawRight: this.keys.has("ArrowRight"),
      ascend: this.keys.has("Space") || this.keys.has("KeyE"),
      descend: this.keys.has("KeyQ") || this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") || this.keys.has("KeyB"),
      boost: this.keys.has("KeyR"),
    }

    const hasKeyboardInput = Object.values(input).some(Boolean)
    if (hasKeyboardInput) this.cancelTransition()

    const yawVelocity = (Number(input.yawRight) - Number(input.yawLeft)) * 0.95
    this.yaw -= yawVelocity * delta
    this.pitch = clamp(this.pitch, -1.18, 1.18)

    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"))
    this.camera.updateMatrixWorld(true)

    const forward = this.camera.getWorldDirection(TEMP_A).normalize()
    const right = TEMP_B.crossVectors(forward, UP).normalize()
    const up = TEMP_C.copy(UP)

    const desiredVelocity = new THREE.Vector3()
    if (input.forward) desiredVelocity.addScaledVector(forward, 1)
    if (input.backward) desiredVelocity.addScaledVector(forward, -0.72)
    if (input.strafeLeft) desiredVelocity.addScaledVector(right, -0.58)
    if (input.strafeRight) desiredVelocity.addScaledVector(right, 0.58)
    if (input.ascend) desiredVelocity.addScaledVector(up, 0.72)
    if (input.descend) desiredVelocity.addScaledVector(up, -0.72)

    const targetSpeed = this.flightSpeed * (input.boost ? 1.9 : 1)
    if (desiredVelocity.lengthSq() > 0) {
      desiredVelocity.normalize().multiplyScalar(targetSpeed)
    }

    const damping = 1 - Math.exp(-delta * (desiredVelocity.lengthSq() > 0 ? 4.8 : 3.4))
    this.velocity.lerp(desiredVelocity, damping)
    this.camera.position.addScaledVector(this.velocity, delta)

    this.camera.position.x = clamp(this.camera.position.x, -WORLD_BOUND, WORLD_BOUND)
    this.camera.position.y = clamp(this.camera.position.y, 9, 1200)
    this.camera.position.z = clamp(this.camera.position.z, -WORLD_BOUND, WORLD_BOUND)
  }

  private updateCars(delta: number) {
    const minX = -BRIDGE_HALF_LENGTH - 85
    const maxX = BRIDGE_HALF_LENGTH + 85

    for (const car of this.cars) {
      car.root.position.x += car.direction * car.speed * delta
      if (car.direction === 1 && car.root.position.x > maxX) car.root.position.x = minX
      if (car.direction === -1 && car.root.position.x < minX) car.root.position.x = maxX
      car.root.position.y = ROAD_Y + 2.4 + Math.sin(this.time * 4.2 + car.root.position.x * 0.01) * 0.04
    }
  }

  private updateFog(delta: number) {
    for (const fog of this.fogActors) {
      fog.sprite.position.x = fog.basePosition.x + Math.sin(this.time * 0.08 + fog.phase) * fog.drift.x
      fog.sprite.position.y = fog.basePosition.y + Math.sin(this.time * 0.12 + fog.phase) * 5
      fog.sprite.position.z = fog.basePosition.z + Math.cos(this.time * 0.07 + fog.phase) * fog.drift.z
      fog.sprite.material.opacity = 0.12 + (Math.sin(this.time * 0.18 + fog.phase) * 0.5 + 0.5) * 0.16
      fog.sprite.scale.set(
        fog.baseScale.x + Math.sin(this.time * 0.09 + fog.phase) * 22,
        fog.baseScale.y + Math.cos(this.time * 0.12 + fog.phase) * 10,
        fog.baseScale.z,
      )
    }
  }

  private cancelTransition() {
    if (!this.transition) return
    this.transition = null
  }

  private render() {
    this.renderer.render(this.scene, this.camera)
  }
}

declare global {
  interface Window {
    render_game_to_text?: () => string
    advanceTime?: (ms: number) => Promise<void> | void
  }
}
