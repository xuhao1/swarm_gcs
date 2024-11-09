from communication import Communication
from simulator import DroneSimulator
from controller import Controller

config = {
    'port': 14550,
    'host': '127.0.0.1',
    'radius': 5,  # 圆周运动的半径
    'height': 2,  # 飞行高度
    'angularVelocity': 3.14159 / 100,  # 角速度
    'initialVoltage': 12.6,  # 初始电池电压
    'finalVoltage': 10.5,  # 末尾电池电压
    'flightTime': 60000,  # 飞行时间
    'startupTime': 5000,  # 刚开机的一段时间
    'hoverTime': 5000,  # 悬停时间
    'waitTime': 10000  # 降落后等待时间
}

def main():
    communication = Communication(config)
    simulator = DroneSimulator(config, communication)
    controller = Controller(simulator, config)
    controller.start()

if __name__ == '__main__':
    main()