import * as THREE from "../third_party/three.js/build/three.webgpu.js";
import {ToThreePose} from "./conversion.mjs";
import { CommanderDefines, generateCommand } from "./defines.mjs";

class UAVCommander {
    constructor(drone_id, ros, ui, opt) {
        console.log("UAVCommander constructor of drone_id: " + drone_id, "opt: ", opt);
        this.ros = ros;
        this.drone_id = drone_id;
        this.connected = false;
        this.pos = {x: 0, y: 0, z: 0};
        this.att = {x: 0, y: 0, z: 0, w: 1};
        this.ui = ui
        this.opt = opt;
        this.setup_ros_conn();

        this.has_odom = false;
    }

    update_opt(opt) {
        this.opt = opt;
    }

    setup_ros_conn() {
        // Subscribers
        let odom_topic = '/uav' + this.drone_id + '/' + this.opt.uav.odom_topic;
        console.log("Subscribing to drone odom topic: " + odom_topic);
        this.odom_sub = new ROSLIB.Topic({
            ros: this.ros,
            name: odom_topic,
            messageType: 'nav_msgs/Odometry'
        });

        this.odom_sub.subscribe(function(msg) {
            this.on_drone_odom(msg);
        }.bind(this));

        // Publish to the command topic: /uav1/drone_commander/onboard_command
        let cmd_topic = '/uav' + this.drone_id + '/' + this.opt.uav.command_topic;
        this.cmd_pub = new ROSLIB.Topic({
            ros: this.ros,
            name: cmd_topic,
            messageType: 'swarmtal_msgs/DroneOnboardCommand'
        });
    }

    on_drone_realtime_info_recv(info) {
        var pos = new THREE.Vector3(info.x, info.y, info.z);
        var quat = new THREE.Quaternion();
        quat.setFromEuler(new THREE.Euler(info.roll/1000.0, info.pitch/1000.0, info.yaw/1000.0));
        this.ui.update_drone_selfpose(this.drone_id, pos, quat, info.vx/100.0, info.vy/100.0, info.vz/100.0);
        this.pos = pos;
    }
    
    on_drone_odom(msg) {
        [this.pos, this.att] = ToThreePose(msg.pose.pose);
        let vel = msg.twist.twist.linear;
        this.ui.update_drone_selfpose(this.drone_id, this.pos, this.att, vel.x, vel.y, vel.z);
        this.has_odom = true;
    }

    on_drone_status_recv(status) {
        this.ui.set_drone_status(this.drone_id, status)
        if (!this.has_odom)
        {
            var pos = new THREE.Vector3(status.pos.x, status.pos.y, status.pos.z);
            var quat = new THREE.Quaternion();
            quat.setFromEuler(new THREE.Euler(0, 0, status.yaw));
            this.ui.update_drone_selfpose(this.drone_id, pos, quat, 0, 0, 0);
        }
        this.ui.update_reference_frame(this.drone_id, 1); //Temp code
    }

    send_command(cmd) {
        console.log("Sending command to drone: " + this.drone_id, "cmd: ", cmd);
        this.cmd_pub.publish(cmd);
    }

    send_takeoff_cmd(height, takeoff_speed) {
        console.log("Sending takeoff command to drone: " + this.drone_id + " height: " + height);
        let cmd = generateCommand(CommanderDefines.CTRL_TAKEOF_COMMAND,
            this.opt.source_id, this.drone_id, Math.round(height*10000),
                Math.round(takeoff_speed*10000));
        this.send_command(cmd);
    }

    send_landing_cmd(landing_speed, is_emergency = false) {
        let param1 = is_emergency ? 1 : 0;
        let cmd = generateCommand(CommanderDefines.CTRL_LANDING_COMMAND,
            this.opt.source_id, this.drone_id, param1, Math.round(landing_speed*10000));
        this.send_command(cmd);
    }

    send_flyto_cmd(pos, use_planner = false, yaw_ff = null, vel_ff = null, acc_ff = null) {
        let cmd_type = use_planner ? CommanderDefines.CTRL_PLANING_TGT_COMMAND : CommanderDefines.CTRL_POS_COMMAND;
        let vel_ff_x_int = vel_ff ? Math.round(vel_ff.x*10000) : 0;
        let vel_ff_y_int = vel_ff ? Math.round(vel_ff.y*10000) : 0;
        let vel_ff_z_int = vel_ff ? Math.round(vel_ff.z*10000) : 0;
        let acc_ff_x_int = acc_ff ? Math.round(acc_ff.x*10000) : 0;
        let acc_ff_y_int = acc_ff ? Math.round(acc_ff.y*10000) : 0;
        let acc_ff_z_int = acc_ff ? Math.round(acc_ff.z*10000) : 0;
        let yaw_ff_int = yaw_ff ? Math.round(yaw_ff*1000) : CommanderDefines.YAW_KEEP;
        let cmd = generateCommand(cmd_type,
            this.opt.source_id, this.drone_id, Math.round(pos.x*10000), Math.round(pos.y*10000), Math.round(pos.z*10000),
            yaw_ff_int, vel_ff_x_int, vel_ff_y_int, vel_ff_z_int, acc_ff_x_int, acc_ff_y_int, acc_ff_z_int);
        this.send_command(cmd);
    }
}

export { UAVCommander };