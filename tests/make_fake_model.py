"""테스트용 가짜 모델: 빨강 높고 파랑 낮으면 인물(로짓). 입력 input_image [1,3,1024,1024] → 출력 output_image [1,1,1024,1024]."""
import numpy as np, onnx
from onnx import helper, TensorProto, numpy_helper
from pathlib import Path
X = helper.make_tensor_value_info('input_image', TensorProto.FLOAT, [1, 3, 1024, 1024])
Y = helper.make_tensor_value_info('output_image', TensorProto.FLOAT, [1, 1, 1024, 1024])
w = numpy_helper.from_array(np.array([6.0, 0.0, -6.0], dtype=np.float32).reshape(1, 3, 1, 1), 'w')
g = helper.make_graph([helper.make_node('Conv', ['input_image', 'w'], ['output_image'])], 'fake', [X], [Y], [w])
m = helper.make_model(g, opset_imports=[helper.make_opsetid('', 17)]); m.ir_version = 8
onnx.save(m, str(Path(__file__).parent / '.vend/fake.onnx'))
