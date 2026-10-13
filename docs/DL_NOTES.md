# Deep-learning explorer: notes (plain statements, reusable as page text)

Teaching example: synthetic data and a public molecule set, small models, not for prediction. Regenerate with `python tools/dl_demo.py` (numpy 2.5.3, scipy 1.18.1, rdkit 2026.09.1, Python 3.13; seeded; plain NumPy, no torch).

## Data
- MLP: 2,000 virtual patients drawn from a known formula, split 70/15/15 by patient (1,400 / 300 / 300). Body weight N(72, 14) truncated to 30-120 kg, age 20-85 y, eGFR 20-120 mL/min/1.73 m2 (correlated with age, r = -0.70), metabolizer class poor / normal / rapid = 10 / 70 / 20 %.
- True apparent clearance: CL = 4.5 (WT/70)^0.75 (eGFR/90)^0.4 g(class), g = 0.55 / 1.0 / 1.35, times lognormal noise (SD 0.10). Target = ln CL. No real subject data.
- GNN: 4,569 organic molecules (C N O F P S Cl Br I, 3-50 heavy atoms, single fragment, de-duplicated) from `Data/NCI/first_5K.smi`, a file that ships inside the RDKit package (NCI Open Database structures). The file is read in place, not copied here. Caffeine, ibuprofen and propranolol are the displayed molecules; caffeine was found in the file and removed, so none of the three was used for training. Split by molecule: 3,198 / 685 / 686.
- GNN target: RDKit Crippen logP, a calculated value (atom-type contributions), not a measurement.

## Models and training
- MLP 5 -> 8 -> 6 -> 1, ReLU, z-scored inputs, Adam (lr 0.003, batch 32), 400 epochs, loss = MSE of ln CL. Snapshots at epochs 0, 1, 2, 5, 10, 20, 50, 100, 200, 400.
- GNN: 8 atom features (element one-hot C/N/O/other, aromatic, degree/4, formal charge, in ring), two rounds h' = ReLU(W (h + sum of neighbours) + b), hidden size 8, mean-pool, linear head giving logP per heavy atom, times the number of heavy atoms. Adam (lr 0.01 with cosine decay), batch 64, 200 epochs; weights from epoch 194 (lowest validation RMSE).
- Back-propagation is hand-written; both implementations match central finite differences (largest relative error 1.3e-7 for the MLP, 2.2e-7 for the GNN; every parameter checked).
- The browser repeats the forward and backward pass (MLP) and the message passing (GNN) from the shipped weights and agrees with the NumPy reference to 5e-7 or better (tolerance 1e-5), see `window.LabWidgets.dlSelfTest()`.

## Validation (held-out data only; test split used once)
- MLP at epoch 400, 300 test patients: R2 = 0.895, RMSE of ln CL = 0.102. The noise-free true function reaches R2 = 0.903 on the same patients, so about 0.9 is the ceiling set by the noise. At epoch 0 (random weights) R2 = -16.8.
- Weight dependence (age 50, eGFR 90, normal metabolizer) vs the true function: largest deviation 8.4 % in CL over 30-120 kg, 4.3 % between 45 and 100 kg.
- GNN, 686 test molecules: R2 = 0.948, RMSE = 0.44 log units. Baselines: atoms x mean logP per atom R2 = 0.33; regression on element counts R2 = 0.81. C/H/N/O-only subset (n = 443): R2 = 0.952.
- Displayed molecules (GNN vs RDKit): caffeine -1.01 vs -1.03, ibuprofen 3.00 vs 3.07, propranolol 2.51 vs 2.58. Only three molecules; they are not a validation set.
- Individual atom contributions of the GNN were not trained and need not match Crippen's atom values.

## What you see (EN)
Left to right, top to bottom: one virtual patient is passed through the network (forward pass), the error is passed back (backward pass), and the snapshot slider replays training. In the second tab a molecule is a graph; atoms exchange numbers with their neighbours, and the averaged result is one logP value.

## Limitations (EN)
Both models are small teaching examples. The MLP learns a formula that we wrote ourselves from simulated patients; its accuracy says nothing about real clearance, which depends on many other factors. The GNN imitates RDKit's Crippen logP, a value calculated from atom-type contributions, on a few thousand structures from a public set; it is not a measured property and was not tested on other chemical series. Neither model should be used for prediction. R2 and RMSE are for held-out data only (split by patient or by molecule).

## 화면 설명 (KO)
왼쪽에서 오른쪽, 위에서 아래로 보면, 가상 환자 한 명이 신경망을 통과하고(순전파), 오차가 거꾸로 전달되며(역전파), 스냅샷 슬라이더로 학습 과정을 다시 볼 수 있습니다. 두 번째 탭에서는 분자가 그래프이며, 원자가 이웃과 숫자를 주고받고 그 평균이 하나의 logP 값이 됩니다.

## 한계 (KO)
두 모형은 모두 작은 교육용 예제입니다. MLP는 우리가 직접 만든 공식을 모의 환자 자료에서 학습하므로, 정확도는 실제 청소율과 무관합니다. 실제 청소율에는 여기에 포함되지 않은 많은 요인이 관여합니다. GNN은 공개 구조 몇천 개로 RDKit의 Crippen logP(원자 유형별 기여로 계산한 값)를 모방하도록 학습했을 뿐이며, 측정된 성질이 아니고 다른 화학 계열에서는 검증하지 않았습니다. 어느 모형도 예측 용도로 사용해서는 안 됩니다. R2와 RMSE는 학습에 쓰지 않은 자료(환자 단위 또는 분자 단위 분할)에서만 계산했습니다.

## ADME/Tox sentence (EN / KO)
In the literature, graph networks of this kind are trained on thousands of measured compounds to predict ADME and toxicity properties (for example Yang et al., 2019, J Chem Inf Model); the model here is far smaller and learns only a calculated logP. / 문헌에서는 이와 같은 그래프 신경망을 실측 화합물 수천 개로 학습시켜 ADME 및 독성 성질을 예측하는 데 사용합니다(예: Yang 등, 2019, J Chem Inf Model). 여기의 모형은 훨씬 작고 계산된 logP만 학습합니다.
