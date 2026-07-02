import * as THREE from 'three';

/**
 * Per-layer globe controller — owns visibility and THREE.Group lifecycle.
 */
export class LayerController {
  constructor(layer, parentGroup) {
    this.layer = layer;
    this.id = layer.id;
    this.visible = layer.globe?.defaultVisible ?? true;
    this.group = new THREE.Group();
    this.group.name = `layer-${layer.id}`;
    parentGroup.add(this.group);
    this.ready = null;
  }

  async init(ctx) {
    const initFn = this.layer.globe?.init;
    if (!initFn) {
      this.group.visible = this.visible;
      return;
    }

    this.ready = (async () => {
      try {
        const content = await initFn(ctx);
        if (content?.isObject3D) {
          this.group.add(content);
        }
        this.group.visible = this.visible;
      } catch (err) {
        console.warn(`Layer ${this.id} unavailable:`, err);
      }
    })();

    await this.ready;
  }

  setVisible(visible) {
    this.visible = visible;
    this.group.visible = visible;
  }

  update(frame, date, ctx) {
    const updateFn = this.layer.globe?.update;
    if (updateFn) updateFn(this.group, frame, date, ctx);
  }

  getAbout() {
    if (this.group.userData?.about) return this.group.userData.about;
    for (const child of this.group.children) {
      if (child.userData?.about) return child.userData.about;
    }
    return null;
  }

  getPickTypes() {
    return this.layer.globe?.pickTypes ?? [];
  }
}

export async function initGlobeLayers(layers, parentGroups, ctx) {
  const controllers = new Map();

  for (const layer of layers) {
    const parentKey = layer.globe?.parent ?? 'surface';
    const parent = parentGroups[parentKey] ?? parentGroups.surface;
    if (!parent || !layer.globe) continue;

    const controller = new LayerController(layer, parent);
    controllers.set(layer.id, controller);
    await controller.init(ctx);
  }

  return controllers;
}