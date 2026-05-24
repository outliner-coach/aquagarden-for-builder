import { SceneRoot } from './core/SceneRoot'
import { RenderLoop } from './core/RenderLoop'
import { Aquascape } from './entities/Aquascape'
import { FishSchool } from './entities/FishSchool'
import { Lighting } from './lighting/Lighting'
import { Bubbles } from './entities/Bubbles'

const container = document.getElementById('app')!

const sceneRoot = new SceneRoot(container)

const lighting = new Lighting()
sceneRoot.add(lighting)

const aquascape = new Aquascape()
sceneRoot.add(aquascape)

const fishSchool = new FishSchool()
sceneRoot.add(fishSchool)

const bubbles = new Bubbles()
sceneRoot.add(bubbles)

const loop = new RenderLoop((dt) => {
  sceneRoot.update(dt)
  sceneRoot.render()
})

loop.start()

// TODO(step-9): hidden 시 loop.stop(), 표시 시 loop.start() 배선
// document.addEventListener('visibilitychange', () => {
//   document.hidden ? loop.stop() : loop.start()
// })
