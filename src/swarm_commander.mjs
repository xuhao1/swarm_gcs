import * as THREE from "../third_party/three.js/build/three.webgpu.js";
import {BaseCommander} from "./base_commander.mjs"
import {UAVCommander} from "./uav_commander.mjs"
import {PointCloud2} from './pointcloud2.mjs';
import {formations, generate_random_formation} from './formations.mjs';

var mavlink = mavlink10;
function _base64ToArrayBuffer(base64) {
    var binary_string = window.atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
}

function tnow() {
    return new Date().getTime() / 1000;
}
  
let vaild_ids = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
let resend_ctrl_times= 3;

let formation_params = {
    xmin: -3,
    xmax: 3,
    ymin: -1,
    ymax: 2,
    zmin: 0.8,
    zmax: 1.8,
    safe_distance_planar: 1.0
};


class SwarmCommander extends BaseCommander{
    constructor(ui) {
        super(ui);
        this.mav = new MAVLink10Processor(null, 0, 0);
        // this.mav = new MAVLink(null, 0, 0);

        this.select_id = -1;
        this._lps_time = 0;

        this.ui.cmder = this;        

        this.update_params(ui.opt);

        this.last_recv_pcl = tnow();
        this.pcl_duration = 0.3;

        this.current_formation = 0;
        
        this.missions = {}

        this.uav_commanders = {};

        this.mission_update();
    }

    update_params (opt) {
        this.opt = opt;
    }
    
    setup_ros_sub_pub_websocket() {
        let ros = this.ros;
        let self = this;
        
        this.swarm_state_topic = new ROSLIB.Topic({
            ros: ros,
            name: "/swarm_commander_state",
            messageType: "swarmtal_msgs/DroneCommanderState",
            queue_length:1
        });

        this.swarm_state_topic.subscribe(function (msg) {
            self.update_swarm_state(msg);
        });

        this.remote_nodes_listener = new ROSLIB.Topic({
            ros: ros,
            name: "/uwb_node/remote_nodes",
            messageType: "swarmcomm_msgs/remote_uwb_info",
            queue_length:1
          });
          
        this.remote_nodes_listener.subscribe(function(msg) {
            self.on_remote_nodes_info(msg);
        });

        this.traj_viz_listener = new ROSLIB.Topic({
            ros: ros,
            name: "/traj_viz",
            messageType: "visualization_msgs/Marker",
            queue_length:10
        });
        
        this.traj_viz_listener.subscribe(function (msg) {
            // console.log(msg);
            self.ui.update_drone_traj(msg.ns, msg.points)
        });

        this.bspine_viz_listener_1 = new ROSLIB.Topic({
            ros: ros,
            name: "/planning/swarm_traj",
            messageType: "bspline/Bspline",
            queue_length:10
        });

        this.bspine_viz_send_listener = new ROSLIB.Topic({
            ros: ros,
            name: "/planning/swarm_traj_send",
            messageType: "bspline/Bspline",
            queue_length:10
        });

        this.bspine_recv_listener = new ROSLIB.Topic({
            ros: ros,
            name: "/planning/swarm_traj_recv",
            messageType: "bspline/Bspline",
            queue_length:10
        });

        this.bspine_viz_listener_1.subscribe(function (msg) {
            // console.log("bspline drone_id", msg.drone_id);
            if (msg.drone_id >= 0) {
                self.ui.update_drone_traj_bspline_localframe(msg.drone_id, msg)
            }
        });

        this.bspine_viz_send_listener.subscribe(function (msg) {
            // console.log("bspline drone_id", msg.drone_id);
            if (msg.drone_id >= 0) {
                self.ui.update_drone_traj_bspline_selfframe(msg.drone_id, msg)
            }
        });
        
        this.bspine_recv_listener.subscribe(function (msg) {
            // console.log("bspline drone_id", msg.drone_id);
            if (msg.drone_id >= 0) {
                self.ui.update_drone_traj_bspline_selfframe(msg.drone_id, msg)
            }
        });
        
        this.swarm_drone_fused = new ROSLIB.Topic({
            ros: ros,
            name: "/swarm_drones/swarm_drone_fused",
            messageType: "swarm_msgs/swarm_fused",
            queue_length:10
        });

        this.swarm_drone_fused.subscribe(function (msg) {
            self.on_swarm_drone_fused(msg);
        });

        this.incoming_data_listener = new ROSLIB.Topic({
            ros: ros,
            name: "/uwb_node/incoming_broadcast_data",
            messageType: "swarmcomm_msgs/incoming_broadcast_data",
            queue_length:1
        });

        this.incoming_data_listener.subscribe(function (incoming_msg) {
            self.on_incoming_data(incoming_msg);
        });

        this.send_uwb_msg = new ROSLIB.Topic({
            ros : ros,
            name : '/uwb_node/send_broadcast_data',
            messageType : 'swarmcomm_msgs/data_buffer'
        });


        this.move_simple_goal = new ROSLIB.Topic({
            ros : ros,
            name : '/move_base_simple/goal',
            messageType : 'geometry_msgs/PoseStamped'
        }); 

        this.change_formation_client = new ROSLIB.Service({
            ros : ros,
            name : '/transformation',
            serviceType : 'swarm_transformation/transformation'
        });

        this.translation_flyto_client = new ROSLIB.Service({
            ros : ros,
            name : '/translation',
            serviceType : 'swarm_transformation/translation'
        });


        this.sub_pcl = new ROSLIB.Topic({
            ros:this.ros,
            messageType:"sensor_msgs/PointCloud2",
            name:"/sdf_map/occupancy_all_4"
        });
        
        this.sub_pcl.subscribe(function (msg) {
            self.on_globalmap_recv(msg);
        });

        this.sub_frontier = new ROSLIB.Topic({
            ros:this.ros,
            messageType:"sensor_msgs/PointCloud2",
            name:"/expl_ground_node/frontier"
        });
        
        this.sub_frontier.subscribe(function (msg) {
            self.on_frontier_recv(msg);
        });
    }
    
    setup_mavlink_on_udp(port=14550) {
        // Use UDP to receive mavlink message, setup the callback function
        // Setup UDP listener
        var dgram = require('dgram');
        let self = this;
        this.udp_server = dgram.createSocket('udp4');
        this.udp_server.bind(port, function() {
            console.log("UDP server bind on port", port);
        }
        );
        this.udp_server.on('message', function(msg, rinfo) {
            let msgs = self.mav.parseBuffer(msg);
            for (var k in msgs) {
                let msg = msgs[k];
                switch (msg.name) {
                    case "NODE_REALTIME_INFO": {
                        self.on_drone_realtime_info_recv(0, msg.lps_time, msg);
                        break;
                    }
                    case "DRONE_STATUS": {
                        self.on_drone_status_recv(0, msg.lps_time, msg);
                        break;
                    }
                }
            }
        });
    }
           

    update_swarm_state(msg) {
        // Check if UAV is created in this.uavs
        let drone_id = msg.drone_id;
        if (!this.uav_commanders[drone_id]) {
            this.uav_commanders[drone_id] = new UAVCommander(drone_id, this.ros, this.ui, this.opt);
        }
        this.uav_commanders[drone_id].on_drone_status_recv(msg);
    }

    on_grid(msg) {
        console.log(msg);
        var ns = msg.ns + msg.id;
        if (msg.action == 2) {
            this.ui.on_marker_delete_lines(ns);
        } else {
            var lines = [];
            for (var i = 0; i < msg.points.length/2; i++) {
                var line = [];
                line.push(msg.points[i*2], msg.points[i*2+1]);
                lines.push(line);
            }
            this.ui.on_marker_add_lines(ns, lines, msg.color);
        }

    }
    


    on_globalmap_recv(msg) {
        var t0 = performance.now()
        var pcl = new PointCloud2(msg, {
            is_frontier: false,
            is_pcl2: true
        });
        var t1 = performance.now()
        this.ui.update_pcl(pcl);
    }

    on_frontier_recv(msg) {
        var t0 = performance.now()
        var pcl = new PointCloud2(msg, {
            is_frontier: true,
            is_pcl2: true
        });
        var t1 = performance.now()
        // console.log("Call to PointCloud2 took " + (t1 - t0) + " milliseconds.")
        
        // this.ui.update_frontier(pcl);
    }

    on_inc_globalmap_recv(msg) {
        var pcl = new PointCloud2(msg);
        this.ui.update_inc_pcl(pcl);
    }
 
    on_incoming_data(incoming_msg) {
        if (!vaild_ids.has(incoming_msg.remote_id)) {
            return;
        }
        
        let ts = tnow();
        //note that message may come from different nodes, should fix here
        var buf;
        if (incoming_msg.data.buffer) {
            buf =  new Uint8Array(incoming_msg.data)
        } else{
            buf = _base64ToArrayBuffer(incoming_msg.data);
        }

        let msgs = this.mav.parseBuffer(buf);
        for (var k in msgs) {
            let msg = msgs[k];
            switch (msg.name) {
                case "NODE_REALTIME_INFO": {
                    this.on_drone_realtime_info_recv(incoming_msg.remote_id, incoming_msg.lps_time, msg);
                    break;
                }

                case "DRONE_STATUS": {
                    // console.log(msg);
                    this.on_drone_status_recv(incoming_msg.remote_id, incoming_msg.lps_time, msg);
                    break;
                }
                case "NODE_LOCAL_FUSED" : {
                    // console.log(msg);
                    this.on_node_local_fused(incoming_msg.remote_id, incoming_msg.lps_time, msg);
                    break;
                }

                case "NODE_BASED_FUSED": {
                    this.on_node_based_coorindate(incoming_msg.remote_id, incoming_msg.lps_time, msg);
                    break;
                }

                case "NODE_DETECTED": {
                    this.on_node_detected(incoming_msg.remote_id, incoming_msg.lps_time, msg);
                    break;
                }

                case "DRONE_ODOM_GT": { //This is not "GT" when send from drone
                    this.on_drone_odom(incoming_msg.remote_id, incoming_msg.lps_time, msg);
                    break;
                }
            }
        }
        let dt = tnow() - ts;
        // console.log("Process time ", dt*1000);
    }


    on_node_detected(_id, lps_time, msg) {
        var pos = new THREE.Vector3(msg.x, msg.y, msg.z);
        var inv_dep = msg.inv_dep / 10000.0;

        this.ui.update_drone_detection(_id, msg.target_id, pos, inv_dep);
    }

    on_node_local_fused(_id, lps_time, msg) {
        // console.log(msg);    
        var pos = new THREE.Vector3(msg.x/1000.0, msg.y/1000.0, msg.z/1000.0);
        var quat = new THREE.Quaternion();
        quat.setFromEuler(new THREE.Euler(0, 0, msg.yaw/1000.0));

        this.ui.update_drone_localpose_in_coorinate(msg.target_id, pos, quat, _id, msg.cov_x/1000.0, msg.cov_y/1000.0, msg.cov_z/1000.0, msg.cov_yaw/1000.0);
    }

    on_node_based_coorindate(_id, lps_time, msg) {
        // console.log(msg);
        // console.log("Based ", _id,"->" ,msg.target_id);
        this.ui.update_drone_based_coorinate(msg.target_id, msg.rel_x/1000.0, msg.rel_y/1000.0, 
            msg.rel_z/1000.0, msg.rel_yaw_offset/1000.0, _id, msg.cov_x/1000.0, msg.cov_y/1000.0, msg.cov_z/1000.0, msg.cov_yaw/1000.0);
    }


    on_remote_nodes_info(msg) {
        var avail = 0;
        for (var i in msg.active) {
          // console.log(i);
          avail += msg.active[i];
        }
        this.ui.set_available_drone_num(avail);
        this.ui.set_total_drone_num(msg.node_ids.length);
        this.ui.set_lps_time(msg.sys_time);
        this.ui.set_self_id(msg.self_id);
    }



    t_last = {
        "1":0,
        "2":0
    }

    
    on_swarm_drone_fused(msg) {
        // console.log(msg);
        for (var i = 0; i< msg.ids.length; i ++) {
            var _id = msg.ids[i];
            var _pos = msg.local_drone_position[i];
            var _vel = msg.local_drone_velocity[i];
            var pos = new THREE.Vector3(_pos.x, _pos.y, _pos.z);
            var yaw = msg.local_drone_yaw[i];
            var quat = new THREE.Quaternion();
            quat.setFromEuler(new THREE.Euler(0, 0, yaw));
            // this.ui.update_drone_selfpose(_id, pos, quat, _vel.x, _vel.y, _vel.z);
            this.ui.update_drone_localpose(_id, pos, quat, _vel.x, _vel.y, _vel.z);
            var status = {
                lps_time: 0,
                flight_status: 0,
                control_auth: 0,
                commander_mode: 0,
                input_mode: 0,
                rc_valid: 1,
                onboard_cmd_valid: 1,
                sdk_valid: 1,
                vo_valid: 1,
                bat_vol: 17.5,
                bat_remain: 1000,
                x: 0, 
                y: 0,
                z: 0,
                yaw: 0
            };
            this.ui.set_drone_status(_id, status);
        }
    }

    send_takeoff_cmd(_id) {
        let uav_opt = this.opt.uav;
        if (_id < 0) {
            // TODO: broadcast instead of sending to each drone
            for (var id_drone in this.uav_commanders) {
                this.uav_commanders[id_drone].send_takeoff_cmd(uav_opt.takeoff_height, uav_opt.takeoff_speed);
            }
        }
        else
        {
            this.uav_commanders[_id].send_takeoff_cmd(uav_opt.takeoff_height,  uav_opt.takeoff_speed);
        }
    }

    send_landing_cmd(_id, is_emergency=false) {
        let uav_opt = this.opt.uav;
        if (_id < 0) 
        {
            // TODO: broadcast instead of sending to each drone
            for (var id_drone in this.uav_commanders) {
                this.uav_commanders[id_drone].send_landing_cmd(uav_opt.landing_speed, is_emergency);
            }
        }
        else
        {
            this.uav_commanders[_id].send_landing_cmd(uav_opt.landing_speed, is_emergency);
        }
    }

    send_flyto_cmd(_id, pos, use_planner) {
        //When use VO coordinates
        console.log("Fly to ", pos, "use_planner", use_planner);
        if (_id < 0) 
        {
            // TODO: broadcast instead of sending to each drone
            for (var id_drone in this.uav_commanders) {
                this.uav_commanders[id_drone].send_flyto_cmd(pos, use_planner);
            }
        }
        else
        {
            this.uav_commanders[_id].send_flyto_cmd(pos, use_planner);
        }
    }

    send_emergency_cmd() {
        console.log("Will send emergency command");
        this.send_landing_cmd(-1, true);
    }

    send_simple_move(_id){
        console.log("Send simple move");
        try{
            var msg = {
                header: {
                    frame_id: "world",
                    stamp: ROSLIB.Date.now()
                },
                pose: {
                    position: {
                        x: 0,
                        y: 0,
                        z: 0,
                    },
                    orientation: {
                        w: 1,
                        x: 0, 
                        y: 0, 
                        z: 0
                    }
                }
            };

            this.move_simple_goal.publish(msg);
        }
        catch(e){
            console.log(e);
        }

        var exp_cmd = 30;
        let scmd = new mavlink.messages.swarm_remote_command (this.lps_time, _id, exp_cmd, 
            0, 
            0, 
            0, 0, 0, 0, 0, 0, 0, 0);
        this.send_msg_to_swarm(scmd);
    }

    send_traj_cmd(_id, cmd) {
        console.log("send traj", cmd);
        if (_id < 0) {
            for (var id_drone in this.ui.uav_local_poses) {
                var pos = this.ui.uav_local_poses[id_drone].pos;
                var ox = pos.x, oy = pos.y, oz = pos.z;
                var T = 30;
                var enable_yaw = cmd;
                var mode = 1;
                if (enable_yaw) {
                    mode = 0;
                }
                console.log("Fly 8 around", ox, oy, oz, "for", id_drone, "mode", mode);
                let scmd = new mavlink.messages.swarm_remote_command (this.lps_time, id_drone, 16, 
                    1, enable_yaw, T*10000, ox*10000, oy*10000, oz*10000, mode, 0, 0, 0);
                this.send_msg_to_swarm(scmd);
            }
        } else {
            var pos = this.ui.uav_local_poses[_id].pos;
            var ox = pos.x, oy = pos.y, oz = pos.z;
            var T = 30;
            var enable_yaw = cmd;
            console.log("Fly 8 around", ox, oy, oz, "for", _id);
            let scmd = new mavlink.messages.swarm_remote_command (this.lps_time, _id, 16, 
                1, enable_yaw, T*10000, ox*10000, oy*10000, oz*10000, 0, 0, 0, 0);
            this.send_msg_to_swarm(scmd);
        }
    }

    send_mission(_id, cmd) {
        console.log("send mission", cmd);
        var ox = 0, oy = 0, oz = 1;
        var T = 30;
        var enable_yaw = cmd;
        let scmd = new mavlink.messages.swarm_remote_command (this.lps_time, _id, 20, 
            cmd, enable_yaw, T*10000, ox*10000, oy*10000, oz*10000, 0, 0, 0, 0);
        this.send_msg_to_swarm(scmd);
    }
    

    send_msg_to_swarm(_msg) {
        let _data = _msg.pack(this.mav);
        try {
            var msg = new ROSLIB.Message({data : _data, send_method: 2});
            this.send_uwb_msg.publish(msg);
        } catch (e) {
            console.log(e);
        }
    }

    send_formation_hold_cmd(master_id, mode) {
        if (mode == 0) {
            let scmd = new mavlink.messages.swarm_remote_command (this.lps_time, -1, 12, 
                master_id, 0, 0, 0, 0, 0, 0, 0, 0, 0);
            console.log("Hold the formation");
            this.send_msg_to_swarm(scmd);
        } else if (mode == 1) {
            let scmd = new mavlink.messages.swarm_remote_command (this.lps_time, -1, 13, 
                master_id, 0, 0, 0, 0, 0, 0, 0, 0, 0);
            console.log("Lock the formation");
            this.send_msg_to_swarm(scmd);
        }
    }

    start_circle_fly(_id, origin, r=1, T=10, yaw_mode="fixed") {
        if (_id < 0) {
            return;
        }
        if (origin == null) {
            if (_id in this.uav_commanders) {
                var pos = this.uav_commanders[_id].pos;
                origin = {
                    x:pos.x,
                    y:pos.y + r,
                    z:pos.z
                }
            }
        }

        this.missions[_id] = {
            "mission": "circle",
            "origin": origin,
            "T": T,
            "ts": tnow(),
            "r": r,
            "yaw_mode": yaw_mode
        }
    }

    stop_mission_id(_id) {
        let scmd = new mavlink.messages.swarm_remote_command (this.lps_time, -1, 99, 
            -1, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        console.log("Hold the formation");
        this.send_msg_to_swarm(scmd);
        if (_id == -1) {
            this.missions = {};
        }
        delete this.missions[_id];
    }

    circle_mission(_id, mission, _tnow) {
        // console.log("circle mission");
        var t = _tnow - mission.ts;
        var r = mission.r;
        var yaw_mode = mission.yaw_mode;
        var ox = mission.origin.x;
        var oy = mission.origin.y;
        var oz = mission.origin.z;
        var T = mission.T;

        var pi = Math.PI;
        var x = ox + Math.sin(t*pi*2/T)*r;
        var y = oy - Math.cos(t*pi*2/T)*r;
        let pos = new THREE.Vector3(x, y, oz);
        var vx = Math.cos(t*pi*2/T) * r * pi*2/T;
        var vy = Math.sin(t*pi*2/T) * r * pi*2/T;
        let vel = new THREE.Vector3(vx, vy, 0);
        var ax = - Math.sin(t*pi*2/T) * r * pi*2/T * pi*2/T;
        var ay = Math.cos(t*pi*2/T) * r * pi*2/T * pi*2/T;
        let acc = new THREE.Vector3(ax, ay, 0);
        let yaw_ff = yaw_mode == "follow" ? -t*pi*2*10000/T: null;
        if ( _id in this.uav_commanders) {
            this.uav_commanders[_id].send_flyto_cmd(pos, false, yaw_ff, vel, acc);
        }
        else 
        {
            console.warn("No such drone id", _id);
        }
    }

    mission_update() {
        // console.log("ms");
        var _tnow = tnow();
        for (var _id in this.missions) {
            var mission = this.missions[_id];
            
            if (mission.mission == "circle") {
                this.circle_mission(_id, mission, _tnow);
            }
        }

        let self = this;
        setTimeout(function() {
            self.mission_update();
        }, 30);
    }

    formation_flyto(pos, with_planner=false) {
        if (this.current_formation < 0) {
            return;
        }
        
        var request = new ROSLIB.ServiceRequest({
            next_formation: this.current_formation,
            des_x: pos.x,
            des_y: pos.y,
            des_z: pos.z
        });

        console.log("Target pos", pos.x, pos.y, pos.z);
        let obj = this;
        this.translation_flyto_client.callService(request, function(result) {
            console.log(result);
            obj.current_formation = result.current_formation;
        });
    }

    request_transformation_change(next_trans) {
        if (next_trans < 100) {
            console.log("Try to request formation, ", next_trans);
            for (var j = 0; j < resend_ctrl_times; j ++) {
                for (var i = 1; i < 6; i ++) {
                    var _pos = formations[next_trans][i];
                    var pos = new THREE.Vector3(_pos.x, _pos.y, _pos.z);
                    var quat = new THREE.Quaternion(0, 0, 0, 1);
                    var ret = this.ui.transfer_vo_with_based(pos, quat, this.ui.primary_id, i);
                    if (ret != null) {
                        this.send_flyto_cmd(i, ret.pos, false);
                    } 
                }
                // await new Promise(r => setTimeout(r, 50));
            }
        } else {
            var formations_random = generate_random_formation(formation_params.xmin, formation_params.xmax, 
                formation_params.ymin, formation_params.ymax, formation_params.zmin, formation_params.zmax, 
                formation_params.safe_distance_planar, [1, 2, 3, 4, 5]);
            console.log("Try to request random formation:", formations_random);

            for (var j = 0; j < resend_ctrl_times; j ++) {
                for (var i = 1; i < 6; i ++) {
                    var _pos = formations_random[i];
                    var pos = new THREE.Vector3(_pos.x, _pos.y, _pos.z);
                    var quat = new THREE.Quaternion(0, 0, 0, 1);
                    var ret = this.ui.transfer_vo_with_based(pos, quat, this.ui.primary_id, i);
                    if (ret != null) {
                        this.send_flyto_cmd(i, ret.pos, false);
                    } 
                }
            }
        }
    }

}


// module.exports = {
//     SwarmCommander:SwarmCommander,
//     SwarmGCSUI:SwarmGCSUI
// }
export {SwarmCommander}
