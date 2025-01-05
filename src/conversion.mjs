import * as THREE from "../third_party/three.js/build/three.webgpu.js";

function ToThreePose(pose) {
    let ros_pos = pose.position;
    let ros_att = pose.orientation;
    var pos = new THREE.Vector3(ros_pos.x, ros_pos.y, ros_pos.z);
    var att = new THREE.Quaternion(ros_att.x, ros_att.x, ros_att.z, ros_att.w);
    return [pos, att];
}

export { ToThreePose };