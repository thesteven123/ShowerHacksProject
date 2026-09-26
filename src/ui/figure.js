export function figureMarkup() {
  return `
    <div class="figure" aria-hidden="true">
      <div class="head">
        <span class="eye left"></span>
        <span class="eye right"></span>
        <span class="mouth"></span>
      </div>
      <div class="torso">
        <span class="arm left">
          <span class="elbow"></span>
          <span class="forearm"><span class="hand"></span></span>
        </span>
        <span class="arm right">
          <span class="elbow"></span>
          <span class="forearm"><span class="hand"></span></span>
        </span>
      </div>
      <div class="legs">
        <span class="leg left"><span class="foot"></span></span>
        <span class="leg right"><span class="foot"></span></span>
      </div>
    </div>
  `;
}

export function doesSixSeven(friend) {
  return /^(maanya|ravi|demo-alex)(-v3)?$/.test(friend.id);
}

function applyPhoto(node, url) {
  if (!node || !url) return;
  node.style.backgroundImage = `url("${url}")`;
  node.classList.add("has-photo");
}

export function applyLimbs(root, friend) {
  const limbs = friend.limbs;
  if (!limbs) {
    applyPhoto(root.querySelector(".head"), friend.imageUrl);
    return;
  }
  const figure = root.querySelector(".figure") ?? root;
  // v2 whole-arm PNGs need the tall arm slot; hide empty forearm/hand stubs.
  const articulated = Boolean(limbs.forearmLeft || limbs.forearmRight);
  figure.classList.toggle("arms-v2", !articulated && Boolean(limbs.armLeft || limbs.armRight));
  applyPhoto(root.querySelector(".head"), limbs.head);
  applyPhoto(root.querySelector(".torso"), limbs.torso);
  applyPhoto(root.querySelector(".arm.left"), limbs.armLeft);
  applyPhoto(root.querySelector(".arm.right"), limbs.armRight);
  applyPhoto(root.querySelector(".arm.left .forearm"), limbs.forearmLeft);
  applyPhoto(root.querySelector(".arm.right .forearm"), limbs.forearmRight);
  applyPhoto(root.querySelector(".arm.left .hand"), limbs.handLeft);
  applyPhoto(root.querySelector(".arm.right .hand"), limbs.handRight);
  applyPhoto(root.querySelector(".leg.left"), limbs.legLeft);
  applyPhoto(root.querySelector(".leg.right"), limbs.legRight);
  applyPhoto(root.querySelector(".leg.left .foot"), limbs.footLeft);
  applyPhoto(root.querySelector(".leg.right .foot"), limbs.footRight);
}
