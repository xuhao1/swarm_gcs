import time

class Controller:
    def __init__(self, simulator, config):
        self.simulator = simulator
        self.config = config

    def start(self):
        self.simulator.start()
        time.sleep(self.config['startupTime'] / 1000)  # 刚开机的一段时间
        self.simulator.hover()
        time.sleep(self.config['hoverTime'] / 1000)  # 悬停时间
        self.simulator.mission()
        self.fly()

    def fly(self):
        while True:
            self.simulator.fly()
            time.sleep(0.01)  # 每0.01秒调用一次fly

    def land(self):
        self.simulator.land()
        time.sleep(5)  # 模拟降落过程，5秒后进入地面状态
        self.simulator.grounded()
        time.sleep(self.config['waitTime'] / 1000)  # 等待一段时间后继续起飞
        self.start()