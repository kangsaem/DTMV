"""PC 엔진 테스트용 가짜 모델: 입력 image [1,3,2048,2048] → 출력 alpha [1,1,2048,2048].
fp16=1 이면 입력·출력 float16 (DirectML 권장 fp16 모델 흉내), 아니면 float32 로짓(시그모이드 밖)."""
import sys, numpy as np, onnx
from onnx import helper, TensorProto, numpy_helper
from pathlib import Path
fp16 = len(sys.argv) > 2 and sys.argv[2] == '1'
T = TensorProto.FLOAT16 if fp16 else TensorProto.FLOAT
X = helper.make_tensor_value_info('image', T, [1, 3, 2048, 2048])
Y = helper.make_tensor_value_info('alpha', T, [1, 1, 2048, 2048])
w = numpy_helper.from_array(np.array([6.0, 0.0, -6.0], dtype=np.float16 if fp16 else np.float32).reshape(1, 3, 1, 1), 'w')
nodes = [helper.make_node('Conv', ['image', 'w'], ['z'])]
nodes.append(helper.make_node('Sigmoid', ['z'], ['alpha']) if fp16 else helper.make_node('Identity', ['z'], ['alpha']))
g = helper.make_graph(nodes, 'fakepc', [X], [Y], [w])
m = helper.make_model(g, opset_imports=[helper.make_opsetid('', 17)]); m.ir_version = 8
out = Path(sys.argv[1]); out.parent.mkdir(parents=True, exist_ok=True); onnx.save(m, str(out)); print('saved', out)
