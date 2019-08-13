import {BaseCommander} from "./base_commander.mjs"
import {PointCloud2} from './pointcloud2.mjs';

function tnow() {
    return new Date().getTime() / 1000;
}

class SoloCommander extends BaseCommander {
    constructor(ui) {
        super(ui);

        this.landing_speed = 0.2;
  
        this.server_ip = this.ui.server_ip;
  
        this.last_recv_pcl = tnow();
        this.pcl_duration = 0.3;
  
    }
    
    setup_ros_sub_pub() {
        let self = this;
        this.sub_pcl2 = new ROSLIB.Topic({
            ros:this.ros,
            messageType:"sensor_msgs/PointCloud2",
            name:"/surfel_fusion/pointcloud"
        });
  
        this.sub_pcl2.subscribe(function (msg) {
            // console.log(pcl.points);
            self.on_pcl2_recv(msg);
        });
  
  
        this.sub_pcl = new ROSLIB.Topic({
            ros:this.ros,
            messageType:"sensor_msgs/PointCloud",
            name:"/sdf_map/occ_pc"
        });
  
        this.sub_pcl.subscribe(function (msg) {
            // console.log(pcl.points);
            self.on_pcl_recv(msg, false);
        });

        this.sub_vo = new ROSLIB.Topic({
            ros:this.ros,
            messageType:"nav_msgs/Odometry",
            name:"/vins_estimator/imu_propagate"
        });

        this.sub_vo.subscribe(function (msg) {
            self.on_vo_msg(msg);
        });
    }

    on_vo_msg(msg) {
        var x = msg.pose.pose.position.x;
        var y = msg.pose.pose.position.y;
        var z = msg.pose.pose.position.z;
        var pos = [x, y, z];
        var quat = [
            msg.pose.pose.orientation.w,
            msg.pose.pose.orientation.x,
            msg.pose.pose.orientation.y,
            msg.pose.pose.orientation.z
        ];
        this.ui.update_drone_selfpose(0, pos, quat);
    }
  
    on_pcl2_recv(msg) {
        if (tnow() - this.last_recv_pcl > this.pcl_duration) {
            var ts = tnow();
            var pcl = new PointCloud2(msg);
            this.ui.update_pcl(pcl);
            this.last_recv_pcl = tnow();
            console.log("Total time " + ((tnow() - ts)*1000.0).toFixed(1) + "ms");
        }    
    }
  
    on_pcl_recv(msg) {
        // if (tnow() - this.last_recv_pcl > this.pcl_duration) 
        {
            var ts = tnow();
            var pcl = new PointCloud2(msg, false);
            this.ui.update_pcl(pcl);
            this.last_recv_pcl = tnow();
            console.log("Total time " + ((tnow() - ts)*1000.0).toFixed(1) + "ms");
        }    
    }
  
    set_server_ip(_ip, reconnect=false) {
        if (reconnect && _ip != this.server_ip) {
            console.log("Need reconect");
            console.log(this.ros);
  
            if(this.connected) {
                this.ros.close();
            }
  
            this.server_ip = _ip;
            this.setup_ros_conn();
        } else {
            this.server_ip = _ip;
        }
    }
  
    send_takeoff_cmd(_id) {
        console.log("Will send takeoff command");
    }
  
    send_landing_cmd(_id) {
        console.log("Will send landing command");
    }
  
    send_flyto_cmd(_id, pos) {
        //When use VO coordinates
        console.log("Fly to ", pos);
    }
  
    send_emergency_cmd() {
        console.log("Will send emergency command");
    }
  
  }
  
export {SoloCommander}
  