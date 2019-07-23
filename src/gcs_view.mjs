import {ThreeView} from "./ThreeView.mjs"

function tnow() {
    return new Date().getTime() / 1000;
}

class SwarmGCSUI {
    constructor() {
        let obj = this;
        this.view = new Vue({
            el: '#container',
            data: {
                self_id: 0,
                remote_nodes: 0,
                available_nodes: 0,
                lps_time: 0,
                ros_conn: "UNCONNECTED",
                ros_conn_color: "red",
                self_id_color: "gray",
                total_remote_color: "gray",
                available_remote_color: "gray",
                lps_time_color:"gray",
                uavs: {}, // { 0:dstatus},
                selected_uav: "All",
                select_id: -1,
                marker_path:""
            },
            methods: {
                select_all: function() {
                    obj.on_select_uav(-1);
                },

                command: function(_cmd) {
                    obj.send_command(_cmd);
                }
            }
        })
        let dstatus = {
            x:0,
            y:0,
            z:0,
            ctrl_mode:0,
            auth_mode:0,
            bat_vol:0
        }

        this.select_id = -1;
        this.warn_count = 0;
        this.last_speak_time = tnow() - 10;

        this.count = 0;
        this.threeview = new ThreeView();
        
    }

    send_command(_cmd) {
        switch (_cmd) {
            case "takeoff":
                this.cmder.send_takeoff_cmd(this.select_id);
                break;
            case "landing":
                this.cmder.send_landing_cmd(this.select_id);
                break;
            case "emergency":
                this.cmder.send_emergency_cmd(this.select_id);
                break;
            default:
                break;
        }

        this.warn_command(_cmd, this.select_id);
    }


    set_ros_conn(_conn) {
        this.view.ros_conn = _conn;
        if (_conn == "CONNECTED") {
            this.view.ros_conn_color = "green";
        } else {
            this.view.ros_conn_color = "red";
        }
    }

    set_self_id(_id) {
        this.view.self_id_color = "green";
        this.view.self_id = _id; 
    }


    set_available_drone_num( _num) {
        this.view.available_nodes = _num;
        this.view.available_remote_color = "green";
    }

    set_total_drone_num(_num) {
        this.view.total_remote_color = "green";
        this.view.remote_nodes = _num;
    }

    set_lps_time(_lps_time) {
        if (this.count ++ % 10 == 0) {
            this.view.lps_time_color = "green"
            this.view.lps_time = _lps_time;
        }
    }

    set_drone_status(_id, status) {
        let ctrl_auths = ["RC", "APP", "ONBOARD"]
        let ctrl_modes = [
            "IDLE",
            "TAKEOFF",
            "LANDING",
            "HOVER",
            "POSVEL",
            "ATT",
            "MISSION"
        ]
        let all_flight_status = [
            "IDLE",
            "ARMED",
            "INAIR",
            "CRASHED"
        ]
        let obj = this;
        Vue.set(this.view.uavs, _id, {
            x:status.x.toFixed(2),
            y:status.y.toFixed(2),
            z:status.z.toFixed(2),
            bat_vol:status.bat_vol.toFixed(2),
            ctrl_auth:ctrl_auths[status.control_auth],
            ctrl_mode:ctrl_modes[status.commander_mode],
            flight_status:all_flight_status[status],
            lps_time:status.lps_time,
            _id:_id,
            ui:obj
        });


        if (status.bat_vol < 14.8) {
            this.warn_battery_level(_id, status.bat_vol);
        }

        if (!status.vo_valid) {
            this.warn_vo_(_id);
        }
        // warn_vo_(_id);

    }

    update_drone_selfpose(_id, x, y, z, yaw = null) {
        if (!this.threeview.has_uav(_id)) {
            this.threeview.insert_uav(_id);
        }
        if (this.threeview.has_uav(_id)) {        
            this.threeview.update_uav_pose(_id, x, y, z, yaw);
        }

    }

    on_select_uav (_id) {
        this.select_id = _id;
        if (_id < 0) {
            this.view.selected_uav = "ALL";
            this.view.marker_path = "";

        } else {
            this.view.selected_uav = "Drone ID: " + _id;
            this.view.marker_path = "./imgs/4x4_1000-"+_id + ".svg";
            console.log(this.view.marker_path);
        }

        this.view.select_id = _id;
        // console.log("S" + _id);
        if (tnow() - this.last_speak_time > 1) {
            // var msg = new SpeechSynthesisUtterance("Node " + _id + ". How 'bout some action? ");
            if (_id < 0) {
                var msg = new SpeechSynthesisUtterance("Total swarm selected!");
                window.speechSynthesis.speak(msg);
            } else {
                var msg = new SpeechSynthesisUtterance("Node " + _id + " selected!");
               window.speechSynthesis.speak(msg);
            }
        } 
        this.last_speak_time = tnow();
    }

    warn_battery_level(id, bat) {
        if (tnow() - this.last_speak_time > 1) {
            // var msg = new SpeechSynthesisUtterance("Warning! Node " + id + " battery is only " + bat.toFixed(1));
            var msg = new SpeechSynthesisUtterance("警告！节点" + id + " 电池只有 " + bat.toFixed(1) + "伏");
            msg.lang = 'zh-CN';
    
            window.speechSynthesis.speak(msg);
        }
        this.last_speak_time = tnow();
    }
  
    warn_vo_(id) {
        if (tnow() - this.last_speak_time > 1) {
            // var msg = new SpeechSynthesisUtterance("Warning! Node " + id + " battery is only " + bat.toFixed(1));
            var msg = new SpeechSynthesisUtterance("警告！节点" + id + " 视觉里程计失效");
            msg.lang = 'zh-CN';
    
            window.speechSynthesis.speak(msg);
            // console.log("try to speak");
        }
        this.last_speak_time = tnow();
    }

    warn_command(_cmd, _id) {
        if (tnow() - this.last_speak_time > 1) {
            var s_drone = "整个集群";
            if (_id >= 0 ) {
                s_drone = "飞行器 " + _id;
            }

            var cmd = ""
            switch (_cmd) {
                case "takeoff":
                    cmd = "起飞";
                    break;
                case "landing":
                    cmd = "降落";
                    break;
                case "emergency":
                    cmd = "紧急降落";
                    break;
                default:
                    cmd = _cmd;
            }

            var msg =  new SpeechSynthesisUtterance(s_drone + cmd + "！");

            msg.lang = 'zh-CN';
    
            window.speechSynthesis.speak(msg);
        }
        this.last_speak_time = tnow();
    }


}



Vue.component('uav-component', {
    methods: {
        select_uav: function (ui, _id) {
            // console.log(ui);
            // console.log(_id);
            ui.on_select_uav(_id);
        }
      },
    props: ["_id", "status"],    
    template:  `     
    <div v-on:click="select_uav(status.ui, status._id)" class="card" style="width: 100%; height=5em;">
    <h5>
      Drone: {{status._id}}
    </h5>
    <ul class="list-group list-group-flush">
    <li class="list-group-item"> BATVOL: {{status.bat_vol}} </li>
    <li class="list-group-item"> 
      X:{{status.x}}
      Y:{{status.y}}
      Z:{{status.z}}
    </li>
    <li class="list-group-item"> 
    <small>
      LPS_TIME {{status.lps_time}}
      CTRL_AUTH <span style="color:green">{{status.ctrl_auth}}</span>
      CTRL_MODE <span style="color:green">{{status.ctrl_mode}}</span>
      FLIGHT_STATUS <span style="color:green">{{status.flight_status}}</span>
    </small>
    </li>
    </ul>
  </div>`
})


export {SwarmGCSUI}
