import * as THREE from 'three'
import { CAMERA } from '../../shared/config'

export interface SceneEntity {
  update(dt: number): void
  dispose(): void
  object3d: THREE.Object3D
}

export class SceneRoot {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer

  private _entities: SceneEntity[] = []

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene()

    const width = container.clientWidth || window.innerWidth
    const height = container.clientHeight || window.innerHeight

    this.camera = new THREE.PerspectiveCamera(
      CAMERA.fov,
      width / height,
      CAMERA.near,
      CAMERA.far,
    )
    this.camera.position.z = 5

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(width, height)

    container.appendChild(this.renderer.domElement)

    window.addEventListener('resize', this._onResize)
  }

  add(entity: SceneEntity): void {
    this._entities.push(entity)
    this.scene.add(entity.object3d)
  }

  update(dt: number): void {
    for (const entity of this._entities) {
      entity.update(dt)
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  resize(): void {
    const width = this.renderer.domElement.parentElement?.clientWidth ?? window.innerWidth
    const height = this.renderer.domElement.parentElement?.clientHeight ?? window.innerHeight
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  dispose(): void {
    window.removeEventListener('resize', this._onResize)
    for (const entity of this._entities) {
      entity.dispose()
    }
    this._entities = []
    this.renderer.dispose()
  }

  private _onResize = (): void => {
    this.resize()
  }
}
