import * as THREE from "three";

// Flat-shaded low-poly chicken assembled from primitives, facing +x.
// Clone this template per live chicken; clones share geometry and materials.
export function createChickenTemplate(): THREE.Group {
  const group = new THREE.Group();
  group.name = "chicken";

  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x8a5a33, flatShading: true });
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xe8e2d8, flatShading: true });
  const redMat = new THREE.MeshLambertMaterial({ color: 0xd84f42, flatShading: true });
  const beakMat = new THREE.MeshLambertMaterial({ color: 0xe8a33d, flatShading: true });

  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), bodyMat);
  body.scale.set(1.25, 1, 1);
  body.name = "body";

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0), bodyMat);
  head.position.set(0.55, 0.42, 0);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 4), beakMat);
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.88, 0.4, 0);

  const comb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.08), redMat);
  comb.position.set(0.52, 0.68, 0);

  const wattle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.08), redMat);
  wattle.position.set(0.62, 0.2, 0);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 4), lightMat);
  tail.rotation.z = Math.PI / 2.6;
  tail.position.set(-0.62, 0.25, 0);

  // wing hinges sit at the body so rotation.x reads as a flap
  const wingGeoL = new THREE.BoxGeometry(0.55, 0.08, 0.7);
  wingGeoL.translate(0, 0, 0.35);
  const wingGeoR = new THREE.BoxGeometry(0.55, 0.08, 0.7);
  wingGeoR.translate(0, 0, -0.35);
  const wingL = new THREE.Mesh(wingGeoL, lightMat);
  wingL.name = "wingL";
  wingL.position.set(0, 0.15, 0.1);
  const wingR = new THREE.Mesh(wingGeoR, lightMat);
  wingR.name = "wingR";
  wingR.position.set(0, 0.15, -0.1);

  group.add(body, head, beak, comb, wattle, tail, wingL, wingR);
  return group;
}

export function flapChicken(group: THREE.Group, time: number, falling: boolean): void {
  const wingL = group.getObjectByName("wingL");
  const wingR = group.getObjectByName("wingR");
  if (!wingL || !wingR) return;
  const flap = falling ? 0.2 : Math.sin(time * 16) * 0.7;
  wingL.rotation.x = -flap;
  wingR.rotation.x = flap;
}

/** Swap every mesh's material for an emissive gold clone; the template stays untouched. */
export function makeGolden(group: THREE.Group): void {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const mat = (obj.material as THREE.MeshLambertMaterial).clone();
      mat.color.set(0xf5c542);
      mat.emissive.set(0xa06a00);
      obj.material = mat;
    }
  });
}
