// webpack.config.js
import path from 'path';

export default {
  entry: './src/index.js',  // 你的入口文件
  output: {
    filename: 'bundle.js',
    path: path.resolve('./dist'),  // 直接使用相对路径
  },
  mode: 'development',
};
