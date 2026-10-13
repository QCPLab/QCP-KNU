/* NLME explorer - replays a real FOCE-I estimation run (computed offline by tools/nlme_demo.py) on SIMULATED data.
   Vanilla JS, SVG, no libraries, no network except the single fetch of data-src. Mount: <div data-lab-widget="nlme-explorer" data-src="..." data-lang="en|ko">.
   The browser recomputes every curve from the stored parameters; nothing is pre-rendered. window.LabWidgets.nlmeSelfTest([data|url]) returns a Promise of {ok, maxAbsErr, checks} comparing JS curves with the Python values (tolerance 1e-6). */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg', NAME = 'nlme-explorer', MINUS = '−', uid = 0;
  var PCOL = ['CL/F', 'V/F', 'ka'];

  /* ------------------------------------------------------------------ strings */
  var TXT = {
    en: {
      title: 'How a population-PK (nonlinear mixed-effects) model is estimated',
      badge: 'Simulated example (30 virtual subjects) — not patient data',
      seeT: 'What you see',
      see: 'The page replays a real estimation run on 30 simulated subjects. Each step of the slider is one accepted iteration of a FOCE-I optimiser that was implemented for this site: the population values (teal curve) move towards the values that generated the data (dashed lines), the objective function falls, and the individual fits (thin blue lines) follow the orange observations. Switch the sampling scenario to see how fewer samples per subject change the final estimates, their precision and the eta-shrinkage (how strongly individual estimates are pulled towards the population mean). All three scenarios use the same 30 subjects and the same noise draws; the smaller designs are subsets of the rich one.',
      scenLbl: 'Sampling scenario', rich: 'Rich', moderate: 'Moderate', sparse: 'Sparse', perSubj: '{n} samples per subject',
      pbLbl: 'Playback of optimiser iterations', play: 'Play', pause: 'Pause', back: 'Step back', fwd: 'Step forward', toFirst: 'First iteration', toLast: 'Last iteration',
      slider: 'Iteration', speed: 'Speed', frameLbl: 'Iteration {it} · frame {k} of {n}',
      reduced: 'Auto-play is off because your system requests reduced motion. Use the step buttons or the slider.',
      thinNo: 'All {n} accepted iterations are shown (iteration 0 = starting values).',
      thinYes: 'Showing {f} of {n} accepted iterations (the first 10, the last 10 and evenly spaced ones in between).',
      stopOk: 'The optimiser stopped after {n} iterations and met its convergence criterion ({msg}). Largest |gradient| of the OFV with respect to the log-scale parameters: {g}.',
      stopBad: 'The optimiser stopped after {n} iterations WITHOUT meeting its convergence criterion ({msg}). Largest |gradient| of the OFV with respect to the log-scale parameters: {g}.',
      fitT: 'Data and fit', obs: 'Observed', ind: 'Individual fits (EBE η̂)', pop: 'Population curve (typical subject)', tru: 'True typical curve (simulation)', sel: 'Selected subject',
      xTime: 'Time after dose (h)', yConc: 'Concentration (mg/L)', logY: 'Log y-axis', showTrue: 'Show true curve', subjLbl: 'Highlight subject', allSubj: 'All subjects', subj: 'Subject {n}',
      fitAlt: 'Concentration versus time for 30 simulated subjects at iteration {it}: orange points are observations, thin blue lines are individual predictions, the thick teal line is the population prediction.',
      subjInfo: 'Subject {n}: η̂ (CL/F, V/F, ka) = {e}; individual CL/F {cl} L/h, V/F {v} L, ka {ka} 1/h. True η used for simulation = {t}.',
      miniCap: 'Selected subject: observation versus individual (IPRED) and population (PRED) prediction, mg/L', miniCols: ['Time (h)', 'Observed', 'IPRED', 'PRED'],
      parT: 'Parameters vs iteration', pnames: ['CL/F (L/h)', 'V/F (L)', 'ka (1/h)', 'ω CL/F', 'ω V/F', 'ω ka', 'σ (proportional)'],
      parNote: 'ω = SD of the log-normal between-subject variability (log scale); σ = proportional residual error. Dashed line = value used to simulate; orange marker = current iteration.',
      truthWord: 'truth', parAlt: '{n}: {v} at iteration {it}, true value {t}.', xIter: 'Iteration',
      ofvT: 'Objective function', ofvLine: 'OFV versus iteration', ofvNote: 'OFV = approximately −2 × log-likelihood summed over subjects, constants included. Only differences matter; negative values are normal for this concentration scale. The values are specific to this implementation and cannot be compared with the output of other software.', dOfv: 'ΔOFV, log scale', ofvAlt: 'Objective function value versus iteration; current iteration {it}, OFV {v}.',
      cT: 'OFV surface (slice over CL/F and V/F)', cAlt: 'Contour plot of the objective function over CL/F and V/F with the optimiser path up to iteration {it}.',
      cNote: 'Contour lines: OFV above the lowest value of the grid (levels {lv}). ka, ω and σ are held at their final values and every subject’s η̂ is re-optimised at each grid point, so the orange path (all parameters moving) only approximately lies on this slice. Outside the dotted rectangle the surface was not computed.',
      cStart: 'start', cEnd: 'final',
      etaT: 'Individual deviations (η̂) and shrinkage', etaNote: 'Dots: η̂ of each subject (click a dot to highlight the subject). Shaded band: ±2ω at this iteration. Shrinkage = 1 − SD(η̂)/ω: high values mean the data of a subject say little about that effect. Small negative values can occur before the fit has converged.',
      showEta: 'Show true η (simulation)', shr: 'η-shrinkage', etaAlt: 'Estimated individual deviations for CL/F, V/F and ka at iteration {it}; shrinkage {s}.',
      tabT: 'Final estimates versus truth', tabCap: 'Estimates at the last stored iteration of each scenario. Below each estimate: percentage deviation from truth, and the approximate relative standard error (RSE) from the numerical Hessian of the OFV at that point. “Truth” is the nominal value used for the simulation; the 30 simulated subjects have a realised spread of η that differs somewhat from the nominal ω, so deviations in ω are expected.',
      tabCols: ['Parameter', 'Truth', 'Rich', 'Moderate', 'Sparse'], shrRow: 'η-shrinkage {n}', itRow: 'Accepted iterations',
      iterT: 'What happens in one iteration', iterSteps: [
        'Inner problem. With the current population values (θ, ω, σ) the optimiser finds, for every subject separately, the individual deviation η̂ that is most probable given that subject’s data (the minimum of Σ[ln var + res²/var] + η′Ω⁻¹η, with the residual variance evaluated at η = interaction).',
        'Laplace objective. The integral over η is approximated around η̂: OFVᵢ = Σ[ln var + res²/var] + η̂′Ω⁻¹η̂ + ln|I + Ω J′R⁻¹J| (+ constants), where J = ∂f/∂η at η̂. The subject values are summed to the OFV in the objective panel.',
        'Update of the population parameters. The outer optimiser (BFGS with a numerical gradient on log-transformed θ, ω, σ) uses how the OFV changes with the parameters to propose new values. Each accepted proposal is one frame of this page.'],
      valT: 'Validation and cross-checks', limT: 'Limitations',
      lim: ['The data are simulated from the same model that is fitted, with one fixed random seed and 30 subjects. One data set per scenario is shown, not an average over repetitions, so single-run deviations from the truth are expected (a replicate study is summarised under Validation).',
        'FOCE-I is an approximation of the exact marginal likelihood (a Laplace approximation with a Gauss-Newton Hessian). The gap to numerically integrated values is reported under Validation.',
        'Only one structural model (one compartment, first-order absorption), a diagonal Ω, a proportional error and no covariates are used. The page is a teaching demonstration, not a substitute for validated software such as NONMEM or nlmixr2, and it has not been compared with their output.'],
      selfOk: 'Browser recomputation check passed: the concentrations recomputed in JavaScript match the Python values (max |Δ| = {e} mg/L, {n} reference values) and the stored iterations are internally consistent ({c} checks).',
      selfBad: 'Browser recomputation check FAILED ({msg}). Do not rely on the curves shown.',
      vJac: 'Sensitivity matrix: analytic J compared with central finite differences over {n} parameter sets (including ka close to ke): largest relative difference {r}.',
      vInner: 'Inner problem: η̂ of every fifth subject compared with an independent bounded L-BFGS-B minimisation from another start: largest difference {d}.',
      vMulti: 'The inner problem has a second (flip-flop) local minimum for some subjects, so it is solved from several starting points. Every stored iteration was re-evaluated from scratch without a warm start: largest OFV difference {d}. At the final estimates a start in the flip-flop mode ended in a different local minimum for {k} subjects (rich / moderate / sparse), with a lower objective for {l} subjects.',
      vNlm: 'nlmixr2 FOCEi comparison: NOT performed — R was not available in the environment that generated the data. The rich data set can be exported with tools/nlme_demo.py --csv for a run elsewhere.',
      vNlmFound: 'nlmixr2 FOCEi comparison: not performed by this script.',
      vLapT: 'Laplace OFV of each subject versus brute-force numerical integration of the marginal likelihood (30 subjects, at each scenario’s final estimates). Gap = Laplace − exact, in OFV units.',
      vLapCols: ['Scenario', 'Samples/subject', 'Mean gap', 'Range of gap', 'Sum of gaps'], vLapStart: 'Rich design at the (poor) starting values: mean gap {m}, range {a} to {b}.',
      vRestT: 'Independent starting values (4 random starts per scenario): largest |ΔOFV| to the main run and largest relative difference of any of the 7 parameters.', vRestCols: ['Scenario', 'Max |ΔOFV|', 'Max difference (%)', 'Converged'],
      vRepT: 'Replicate study: median error (%) over {n} newly simulated data sets per scenario (same estimator, same starting values). The scenarios share the same subjects, so the columns are not independent, and with so few data sets the medians are imprecise.', vRepCols: ['Parameter', 'Rich', 'Moderate', 'Sparse'], vRepConv: 'Converged runs',
      loading: 'Loading the example…', fail: 'The example data could not be loaded.', liveLbl: 'Current state',
      cap0: 'Iteration 0 (starting values): OFV {ofv}; CL/F {cl} L/h, V/F {v} L, ka {ka} 1/h.',
      cap: 'Iteration {it}: OFV {ofv} ({d} since iteration {pv}); CL/F {a} → {b} L/h.', capEnd: ' Final stored iteration.',
      units: ['L/h', 'L', '1/h']
    },
    ko: {
      title: '집단 약동학(비선형 혼합효과) 모형은 이렇게 추정됩니다',
      badge: '시뮬레이션 예제(가상 30명) — 실제 환자 자료가 아닙니다',
      seeT: '화면에서 볼 수 있는 내용',
      see: '이 페이지는 가상 30명의 시뮬레이션 자료에 대해 실제로 수행한 추정 과정을 재생합니다. 슬라이더의 한 칸은 이 사이트를 위해 직접 구현한 FOCE-I 최적화 알고리즘이 채택한 반복 한 번에 해당합니다. 모집단 값(청록색 곡선)이 자료를 만든 참값(점선)에 가까워지고, 목적함수가 감소하며, 개인별 적합선(가는 파란선)이 주황색 관측값을 따라가는 모습을 볼 수 있습니다. 표본 수 시나리오를 바꾸면 개인당 표본이 적을 때 최종 추정값, 정밀도, 에타 수축(개인별 추정값이 모집단 평균 쪽으로 끌려가는 정도)이 어떻게 달라지는지 확인할 수 있습니다. 세 시나리오는 같은 가상 피험자 30명과 같은 잡음을 사용하며, 표본이 적은 설계는 풍부 설계의 일부입니다.',
      scenLbl: '채혈 시나리오', rich: '풍부', moderate: '중간', sparse: '희박', perSubj: '개인당 {n}점',
      pbLbl: '최적화 반복 재생', play: '재생', pause: '일시정지', back: '한 단계 뒤로', fwd: '한 단계 앞으로', toFirst: '처음 반복', toLast: '마지막 반복',
      slider: '반복', speed: '속도', frameLbl: '반복 {it}회 · 프레임 {k}/{n}',
      reduced: '시스템에서 동작 줄이기를 요청했으므로 자동 재생이 꺼져 있습니다. 단계 버튼이나 슬라이더를 사용하십시오.',
      thinNo: '채택된 반복 {n}회를 모두 표시합니다(반복 0 = 초기값).',
      thinYes: '채택된 반복 {n}회 중 {f}개를 표시합니다(처음 10개, 마지막 10개, 그 사이는 균등 간격).',
      stopOk: '최적화 알고리즘이 {n}회 반복 후 수렴 기준을 충족하여 종료했습니다({msg}). 로그 척도 모수에 대한 OFV 기울기의 최댓값은 {g}입니다.',
      stopBad: '최적화 알고리즘이 {n}회 반복 후 수렴 기준을 충족하지 못한 채 종료했습니다({msg}). 로그 척도 모수에 대한 OFV 기울기의 최댓값은 {g}입니다.',
      fitT: '자료와 적합', obs: '관측값', ind: '개인별 적합(EBE η̂)', pop: '모집단 곡선(전형적 개체)', tru: '참 전형 곡선(시뮬레이션)', sel: '선택한 개체',
      xTime: '투여 후 시간 (h)', yConc: '농도 (mg/L)', logY: '로그 y축', showTrue: '참 곡선 표시', subjLbl: '개체 강조', allSubj: '전체 개체', subj: '개체 {n}',
      fitAlt: '반복 {it}회 시점에서 가상 30명의 농도-시간 그래프입니다. 주황색 점은 관측값, 가는 파란선은 개인별 예측, 굵은 청록색 선은 모집단 예측입니다.',
      subjInfo: '개체 {n}: η̂ (CL/F, V/F, ka) = {e}; 개인별 CL/F {cl} L/h, V/F {v} L, ka {ka} 1/h. 시뮬레이션에 사용한 참 η = {t}.',
      miniCap: '선택한 개체: 관측값과 개인별(IPRED)·모집단(PRED) 예측값 비교, mg/L', miniCols: ['시간 (h)', '관측값', 'IPRED', 'PRED'],
      parT: '반복에 따른 모수 변화', pnames: ['CL/F (L/h)', 'V/F (L)', 'ka (1/h)', 'ω CL/F', 'ω V/F', 'ω ka', 'σ (비례 오차)'],
      parNote: 'ω는 로그정규 개체간 변동의 표준편차(로그 척도), σ는 비례 잔차 오차입니다. 점선은 시뮬레이션에 사용한 값, 주황색 표시는 현재 반복입니다.',
      truthWord: '참값', parAlt: '{n}: 반복 {it}회에서 {v}, 참값 {t}.', xIter: '반복',
      ofvT: '목적함수', ofvLine: '반복에 따른 OFV', ofvNote: 'OFV는 개체별 합산 로그우도의 약 −2배이며 상수를 포함합니다. 차이만 의미가 있고, 이 농도 척도에서는 음수가 나오는 것이 정상입니다. 값은 이 구현에 고유하므로 다른 소프트웨어의 출력과 직접 비교할 수 없습니다.', dOfv: 'ΔOFV, 로그 척도', ofvAlt: '반복에 따른 목적함수 값입니다. 현재 반복 {it}회, OFV {v}.',
      cT: 'OFV 곡면(CL/F·V/F 단면)', cAlt: 'CL/F와 V/F에 대한 목적함수 등고선 그래프이며 반복 {it}회까지의 최적화 경로를 함께 보여 줍니다.',
      cNote: '등고선은 격자의 최솟값보다 높은 OFV입니다(수준 {lv}). ka, ω, σ는 최종 추정값으로 고정하고 각 격자점에서 모든 개체의 η̂를 다시 최적화했으므로, 모든 모수가 함께 움직이는 주황색 경로는 이 단면에 근사적으로만 놓입니다. 점선 사각형 바깥에서는 곡면을 계산하지 않았습니다.',
      cStart: '시작', cEnd: '최종',
      etaT: '개인별 편차(η̂)와 수축', etaNote: '점은 각 개체의 η̂입니다(점을 누르면 해당 개체가 강조됩니다). 음영 띠는 현재 반복의 ±2ω입니다. 수축 = 1 − SD(η̂)/ω이며, 값이 크면 개체별 자료가 해당 효과에 대한 정보를 거의 주지 못한다는 뜻입니다. 수렴하기 전에는 값이 약간 음수일 수 있습니다.',
      showEta: '참 η 표시(시뮬레이션)', shr: 'η 수축', etaAlt: '반복 {it}회에서 CL/F, V/F, ka의 개인별 편차 추정값이며 수축은 {s}입니다.',
      tabT: '최종 추정값과 참값', tabCap: '각 시나리오의 마지막 저장 반복에서의 추정값입니다. 추정값 아래에 참값 대비 편차(%)와, 그 지점에서 OFV의 수치 헤시안으로 구한 근사 상대표준오차(RSE)를 표시했습니다. “참값”은 시뮬레이션에 쓴 명목값이며, 시뮬레이션된 30명의 실제 η 분포는 명목 ω와 다소 다르므로 ω의 편차는 예상되는 결과입니다.',
      tabCols: ['모수', '참값', '풍부', '중간', '희박'], shrRow: 'η 수축 {n}', itRow: '채택된 반복 횟수',
      iterT: '한 번의 반복에서 일어나는 일', iterSteps: [
        '내부 문제. 현재의 모집단 값(θ, ω, σ)에서 각 개체마다 그 개체의 자료로 볼 때 가장 그럴듯한 개인 편차 η̂를 찾습니다(Σ[ln var + res²/var] + η′Ω⁻¹η의 최솟값이며, 잔차 분산을 η에서 계산하는 것이 상호작용입니다).',
        '라플라스 목적함수. η에 대한 적분을 η̂ 주변에서 근사합니다: OFVᵢ = Σ[ln var + res²/var] + η̂′Ω⁻¹η̂ + ln|I + Ω J′R⁻¹J| (+ 상수), 여기서 J = η̂에서의 ∂f/∂η입니다. 개체별 값을 합한 것이 목적함수 패널의 OFV입니다.',
        '모집단 모수 갱신. 바깥쪽 최적화 알고리즘(로그 변환한 θ, ω, σ에 대한 수치 기울기를 쓰는 BFGS)이 모수 변화에 따른 OFV 변화를 이용해 새 값을 제안합니다. 채택된 제안 하나가 이 페이지의 한 프레임입니다.'],
      valT: '검증과 교차 확인', limT: '한계',
      lim: ['자료는 적합에 쓰는 것과 같은 모형으로 시뮬레이션했으며, 난수 시드는 하나로 고정했고 개체는 30명입니다. 시나리오마다 자료 한 세트만 보여 주며 반복 시행의 평균이 아니므로, 한 번의 시행에서 참값과 차이가 나는 것은 당연합니다(반복 시뮬레이션 결과는 검증 항목에 요약되어 있습니다).',
        'FOCE-I는 정확한 주변 우도의 근사입니다(가우스-뉴턴 헤시안을 쓰는 라플라스 근사). 수치 적분 값과의 차이는 검증 항목에 보고합니다.',
        '구조 모형은 한 가지(1구획, 1차 흡수), 분산-공분산 행렬은 대각 Ω, 오차는 비례 오차이며 공변량은 없습니다. 이 페이지는 교육용 시연이며 NONMEM이나 nlmixr2 같은 검증된 소프트웨어를 대체하지 않고, 그 출력과 비교한 적도 없습니다.'],
      selfOk: '브라우저 재계산 점검을 통과했습니다. JavaScript로 다시 계산한 농도가 Python 값과 일치하며(최대 |Δ| = {e} mg/L, 기준값 {n}개) 저장된 반복 자료도 서로 일관됩니다(점검 {c}건).',
      selfBad: '브라우저 재계산 점검에 실패했습니다({msg}). 표시된 곡선을 신뢰하지 마십시오.',
      vJac: '민감도 행렬: 해석적 J를 중심 유한차분과 {n}개 모수 조합(ka가 ke에 가까운 경우 포함)에서 비교했을 때 상대 차이의 최댓값은 {r}입니다.',
      vInner: '내부 문제: 5번째마다 선택한 개체의 η̂를 다른 시작점에서 수행한 경계 제약 L-BFGS-B 최소화와 비교했을 때 차이의 최댓값은 {d}입니다.',
      vMulti: '내부 문제에는 일부 개체에서 두 번째(flip-flop) 국소 최솟값이 있어 여러 시작점에서 풉니다. 저장된 모든 반복을 워밍 스타트 없이 처음부터 다시 계산했을 때 OFV 차이의 최댓값은 {d}입니다. 최종 추정값에서 flip-flop 영역의 시작점은 {k}명(풍부 / 중간 / 희박)에서 다른 국소 최솟값에 도달했고, 목적함수가 더 낮은 경우는 {l}명이었습니다.',
      vNlm: 'nlmixr2 FOCEi 비교: 수행하지 못했습니다. 자료를 생성한 환경에 R이 설치되어 있지 않았습니다. 풍부 자료는 tools/nlme_demo.py --csv로 내보내 다른 환경에서 실행할 수 있습니다.',
      vNlmFound: 'nlmixr2 FOCEi 비교: 이 스크립트에서는 수행하지 않았습니다.',
      vLapT: '개체별 라플라스 OFV와 주변 우도의 무차별 수치 적분 비교입니다(각 시나리오의 최종 추정값에서 30명). 차이 = 라플라스 − 정확값, OFV 단위입니다.',
      vLapCols: ['시나리오', '개인당 표본', '평균 차이', '차이 범위', '차이 합'], vLapStart: '풍부 설계, (불량한) 초기값에서: 평균 차이 {m}, 범위 {a} ~ {b}.',
      vRestT: '독립적인 시작값(시나리오마다 무작위 4회): 본 실행과의 |ΔOFV| 최댓값과 7개 모수 중 상대 차이의 최댓값입니다.', vRestCols: ['시나리오', '|ΔOFV| 최댓값', '최대 차이(%)', '수렴'],
      vRepT: '반복 시뮬레이션: 시나리오마다 새로 만든 자료 {n}세트(같은 추정 방법, 같은 초기값)에서 오차(%)의 중앙값입니다. 세 시나리오는 같은 피험자를 공유하므로 열은 서로 독립이 아니며, 자료 세트 수가 적어 중앙값은 정밀하지 않습니다.', vRepCols: ['모수', '풍부', '중간', '희박'], vRepConv: '수렴한 실행',
      loading: '예제를 불러오는 중입니다…', fail: '예제 자료를 불러오지 못했습니다.', liveLbl: '현재 상태',
      cap0: '반복 0회(초기값): OFV {ofv}; CL/F {cl} L/h, V/F {v} L, ka {ka} 1/h.',
      cap: '반복 {it}회: OFV {ofv} (반복 {pv}회 대비 {d}); CL/F {a} → {b} L/h.', capEnd: ' 마지막 저장 반복입니다.',
      units: ['L/h', 'L', '1/h']
    }
  };

  /* ------------------------------------------------------------------ model (shared with Python) */
  function gfun(x) {
    if (Math.abs(x) < 0.02) return 1 - x / 2 + x * x / 6 - Math.pow(x, 3) / 24 + Math.pow(x, 4) / 120 - Math.pow(x, 5) / 720 + Math.pow(x, 6) / 5040;
    return -Math.expm1(-x) / x;
  }
  function conc(cl, v, ka, t, dose) { var ke = cl / v; return dose * ka / v * t * Math.exp(-ke * t) * gfun((ka - ke) * t); }

  /* ------------------------------------------------------------------ small helpers */
  function el(tag, cls, text, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; }
  function sv(parent, name, attrs, text) {
    var e = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function scroller(parent, label) { var d = el('div', 'nx-scroll', null, parent); d.tabIndex = 0; d.setAttribute('role', 'region'); d.setAttribute('aria-label', label); return d; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function tpl(s, o) { return s.replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : m; }); }
  function num(x, d) { var s = Number(x).toFixed(d); return s.replace(/^-(?=0*\.?0*$)/, '').replace('-', MINUS); }
  function sgn(x, d) { return (x >= 0 && Math.abs(x) >= 0.5 * Math.pow(10, -d) ? '+' : '') + num(x, d); }
  function sig3(x) { var a = Math.abs(x); if (a === 0) return '0'; if (a >= 100) return num(x, 0); if (a >= 10) return num(x, 1); if (a >= 1) return num(x, 2); if (a >= 0.1) return num(x, 3); return num(x, 4); }
  function lin(d0, d1, r0, r1) { return function (v) { return r0 + (v - d0) / (d1 - d0) * (r1 - r0); }; }
  function niceStep(range, n) { var raw = range / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; }
  function linTicks(a, b, n) { var s = niceStep(b - a, n), t = [], v = Math.ceil(a / s - 1e-9) * s; for (; v <= b + s * 1e-9; v += s) t.push(+v.toPrecision(10)); return t; }
  function logTicks(a, b) {
    var r = b / a, mult = r < 4 ? [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9] : r < 12 ? [1, 2, 3, 4, 5, 6, 8] : [1, 2, 5], t = [];
    for (var p = Math.floor(Math.log10(a)) - 1; p <= Math.ceil(Math.log10(b)); p++) mult.forEach(function (m) { var v = m * Math.pow(10, p); if (v >= a * 0.999 && v <= b * 1.001) t.push(+v.toPrecision(6)); });
    return t;
  }
  function thinTicks(ticks, sc, minPx) { var out = [], last = -1e9; ticks.forEach(function (v) { var x = sc(v); if (Math.abs(x - last) >= minPx) { out.push(v); last = x; } }); return out; }
  function tickFmt(v) { var a = Math.abs(v); if (a === 0) return '0'; if (a >= 100) return num(v, 0); if (a >= 10) return num(v, 0); if (a >= 1) return String(+v.toFixed(2)).replace('-', MINUS); if (a >= 0.01) return String(+v.toFixed(3)).replace('-', MINUS); return v.toExponential(0).replace('-', MINUS); }
  function sci(x) { return x === 0 ? '0' : x.toExponential(1); }
  function sd(a) { var m = 0, s = 0, n = a.length; a.forEach(function (v) { m += v; }); m /= n; a.forEach(function (v) { s += (v - m) * (v - m); }); return Math.sqrt(s / (n - 1)); }
  function shrinkage(frame, k) { return 1 - sd(frame.eta.map(function (e) { return e[k]; })) / frame.omega[k]; }

  /* axes: o = {w,h,m,xs,ys,xt,yt,xf,yf,xl,yl,noGrid} */
  function axes(g, o) {
    var m = o.m, w = o.w, h = o.h;
    (o.yt || []).forEach(function (v) {
      var y = o.ys(v);
      if (!o.noGrid) sv(g, 'line', { x1: m.l, x2: w - m.r, y1: y, y2: y, 'class': 'nx-gl' });
      sv(g, 'text', { x: m.l - 5, y: y + 3.5, 'text-anchor': 'end', 'class': 'nx-tk' }, (o.yf || tickFmt)(v));
    });
    (o.xt || []).forEach(function (v) {
      var x = o.xs(v);
      sv(g, 'line', { x1: x, x2: x, y1: h - m.b, y2: h - m.b + 4, 'class': 'nx-ax' });
      sv(g, 'text', { x: x, y: h - m.b + 15, 'text-anchor': 'middle', 'class': 'nx-tk' }, (o.xf || tickFmt)(v));
    });
    sv(g, 'line', { x1: m.l, x2: w - m.r, y1: h - m.b, y2: h - m.b, 'class': 'nx-ax' });
    sv(g, 'line', { x1: m.l, x2: m.l, y1: m.t, y2: h - m.b, 'class': 'nx-ax' });
    if (o.xl) sv(g, 'text', { x: (m.l + w - m.r) / 2, y: h - 4, 'text-anchor': 'middle', 'class': 'nx-al' }, o.xl);
    if (o.yl) sv(g, 'text', { transform: 'translate(11,' + ((m.t + h - m.b) / 2) + ') rotate(-90)', 'text-anchor': 'middle', 'class': 'nx-al' }, o.yl);
  }
  function setSvg(svg, w, h, label) { clear(svg); svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h); svg.setAttribute('width', w); svg.setAttribute('height', h); svg.setAttribute('aria-label', label); }
  function path(pts) { var d = '', pen = false; pts.forEach(function (p) { if (p) { d += (pen ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); pen = true; } else pen = false; }); return d; }

  /* ------------------------------------------------------------------ self test */
  function selfTest(data) {
    var checks = [], maxErr = 0, nvals = 0, tol = (data.selftest && data.selftest.tolerance) || 1e-6;
    function chk(name, ok, detail) { checks.push({ name: name, ok: !!ok, detail: detail || '' }); }
    if (data.selftest) {
      data.selftest.cases.forEach(function (c) {
        data.selftest.times.forEach(function (t, i) { var e = Math.abs(conc(c.cl, c.v, c.ka, t, data.selftest.dose) - c.conc[i]); if (!(e <= maxErr)) maxErr = e; nvals++; });
      });
      chk('concentration recomputation', maxErr <= tol, 'max abs diff ' + maxErr.toExponential(2));
    } else chk('selftest block present', false);
    var nS = data.subjects.length;
    ['rich', 'moderate', 'sparse'].forEach(function (name) {
      var s = data.scenarios[name], fr = s && s.frames;
      if (!fr) { chk(name + ' present', false); return; }
      chk(name + ': <= 60 frames, starts at iteration 0', fr.length <= 60 && fr[0].iter === 0, fr.length + ' frames');
      var okThin = true;
      if (s.thinned) { for (var i = 0; i < 10; i++) okThin = okThin && fr[i].iter === i && fr[fr.length - 1 - i].iter === s.n_iter_total - i; }
      else okThin = fr[fr.length - 1].iter === fr.length - 1;
      chk(name + ': frame/iteration bookkeeping', okThin);
      chk(name + ': eta table is ' + nS + ' x 3 in every frame', fr.every(function (f) { return f.eta.length === nS && f.eta.every(function (e) { return e.length === 3; }); }));
      var last = fr[fr.length - 1], fin = s.final, close = true;
      last.theta.concat(last.omega, [last.sigma]).forEach(function (v, i) { var r = fin.theta.concat(fin.omega, [fin.sigma])[i]; close = close && Math.abs(v / r - 1) < 1e-6; });
      chk(name + ': last frame equals final block', close && Math.abs(last.ofv - fin.ofv) < 1e-3);
      var sh = [0, 1, 2].map(function (k) { return shrinkage(last, k); }), dsh = 0;
      sh.forEach(function (v, k) { dsh = Math.max(dsh, Math.abs(v - fin.shrinkage[k])); });
      chk(name + ': shrinkage recomputed in the browser matches Python', dsh < 2e-3, 'max diff ' + dsh.toExponential(2));
      chk(name + ': OFV never increases between stored iterations', fr.every(function (f, i) { return i === 0 || f.ofv <= fr[i - 1].ofv + 1e-6; }));
      var n = s.surface.n;
      chk(name + ': OFV surface is ' + n + ' x ' + n, s.surface.z.length === n && s.surface.z.every(function (r) { return r.length === n; }));
    });
    var ok = checks.every(function (c) { return c.ok; });
    return { ok: ok, maxAbsErr: maxErr, tolerance: tol, nValues: nvals, checks: checks, failed: checks.filter(function (c) { return !c.ok; }).map(function (c) { return c.name; }) };
  }

  /* ------------------------------------------------------------------ widget */
  function build(root, data, lang) {
    var T = TXT[lang], id = ++uid, subjects = data.subjects, nS = subjects.length, dose = data.dose, truth = data.truth;
    var reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    var S = { scen: 'rich', fi: 0, playing: false, speed: 1, logY: false, showTrue: true, showEta: false, ofvLog: false, subj: 0, timer: null };
    var self = selfTest(data);
    var X = {};            // element refs
    var fmtU = T.units;

    function scen() { return data.scenarios[S.scen]; }
    function frames() { return scen().frames; }
    function frame() { return frames()[S.fi]; }
    function indiv(fr, i) { return [fr.theta[0] * Math.exp(fr.eta[i][0]), fr.theta[1] * Math.exp(fr.eta[i][1]), fr.theta[2] * Math.exp(fr.eta[i][2])]; }
    function obsOf(i) { var s = scen().sampling[i]; return s.map(function (k) { return [data.times_rich[k], subjects[i].y[k]]; }); }

    /* ---------- skeleton */
    root.textContent = '';
    root.classList.add('nx-root');
    root.setAttribute('lang', lang);
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', T.title);
    var head = el('header', 'nx-head', null, root);
    el('h3', 'nx-title', T.title, head);
    el('p', 'nx-badge', T.badge, head).setAttribute('role', 'note');
    var see = el('div', 'nx-see', null, head);
    el('h3', 'nx-h3', T.seeT, see); el('p', 'nx-p', T.see, see);

    var ctl = el('section', 'nx-controls', null, root);
    ctl.setAttribute('aria-label', T.pbLbl);
    var r1 = el('div', 'nx-row', null, ctl);
    el('span', 'nx-lbl', T.scenLbl, r1);
    var seg = el('div', 'nx-seg', null, r1); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', T.scenLbl);
    X.segBtn = {};
    ['rich', 'moderate', 'sparse'].forEach(function (k) {
      var b = el('button', 'nx-btn nx-segbtn', null, seg); b.type = 'button';
      el('span', 'nx-seg1', T[k], b); el('span', 'nx-seg2', tpl(T.perSubj, { n: data.scenarios[k].n_per_subject }), b);
      b.addEventListener('click', function () { setScen(k); });
      X.segBtn[k] = b;
    });
    var r2 = el('div', 'nx-row nx-pb', null, ctl);
    function ib(label, glyph, fn) { var b = el('button', 'nx-btn nx-ibtn', glyph, r2); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; b.addEventListener('click', fn); return b; }
    X.first = ib(T.toFirst, '⏮', function () { pause(); go(0, true); });
    X.back = ib(T.back, '◀', function () { pause(); go(S.fi - 1, true); });
    X.play = el('button', 'nx-btn nx-primary', T.play, r2); X.play.type = 'button'; X.play.addEventListener('click', function () { S.playing ? pause(true) : play(); });
    X.fwd = ib(T.fwd, '▶', function () { pause(); go(S.fi + 1, true); });
    X.last = ib(T.toLast, '⏭', function () { pause(); go(frames().length - 1, true); });
    var sl = el('div', 'nx-slwrap', null, r2);
    X.slider = el('input', 'nx-range', null, sl); X.slider.type = 'range'; X.slider.min = 0; X.slider.step = 1; X.slider.value = 0; X.slider.setAttribute('aria-label', T.slider);
    X.slider.addEventListener('input', function () { pause(); go(+X.slider.value, false); });
    X.slider.addEventListener('change', function () { announce(); });
    X.frameLbl = el('span', 'nx-frame', '', sl);
    var spw = el('label', 'nx-speed', null, r2); el('span', 'nx-lbl', T.speed, spw);
    X.speed = el('select', 'nx-sel', null, spw);
    [0.5, 1, 2, 4].forEach(function (v) { var o = el('option', null, v + '×', X.speed); o.value = v; if (v === 1) o.selected = true; });
    X.speed.addEventListener('change', function () { S.speed = +X.speed.value; });
    X.note = el('p', 'nx-note', '', ctl);
    X.reduced = el('p', 'nx-note nx-warn', T.reduced, ctl); X.reduced.hidden = true;
    X.caption = el('p', 'nx-caption', '', ctl);

    var grid = el('div', 'nx-grid', null, root);
    function panel(cls, title) { var s = el('section', 'nx-panel ' + cls, null, grid); var h = el('h3', 'nx-h3', title, s); h.id = 'nx' + id + cls.replace(/\W/g, ''); s.setAttribute('aria-labelledby', h.id); return s; }
    function svgEl(parent, role) { var s = sv(null, 'svg', { 'class': 'nx-svg', role: 'img', focusable: 'false' }); parent.appendChild(s); return s; }

    // fit panel
    var pf = panel('nx-fit', T.fitT);
    var tb = el('div', 'nx-toolbar', null, pf);
    var sw = el('label', 'nx-field', null, tb); el('span', 'nx-lbl', T.subjLbl, sw);
    X.subj = el('select', 'nx-sel', null, sw);
    var o0 = el('option', null, T.allSubj, X.subj); o0.value = 0;
    subjects.forEach(function (s) { var o = el('option', null, tpl(T.subj, { n: s.id }), X.subj); o.value = s.id; });
    X.subj.addEventListener('change', function () { S.subj = +X.subj.value; render(); announce(); });
    function tog(label, key, parent, after) { var b = el('button', 'nx-btn nx-tog', label, parent); b.type = 'button'; b.setAttribute('aria-pressed', S[key]); b.addEventListener('click', function () { S[key] = !S[key]; b.setAttribute('aria-pressed', S[key]); after(); }); return b; }
    tog(T.logY, 'logY', tb, render); tog(T.showTrue, 'showTrue', tb, render);
    X.fitBox = el('div', 'nx-chart', null, pf); X.fitSvg = svgEl(X.fitBox);
    var lg = el('ul', 'nx-legend', null, pf);
    [['nx-sw-obs', T.obs], ['nx-sw-ind', T.ind], ['nx-sw-pop', T.pop], ['nx-sw-tru', T.tru], ['nx-sw-sel', T.sel]].forEach(function (a) { var li = el('li', null, null, lg); el('i', 'nx-sw ' + a[0], null, li); el('span', null, a[1], li); });
    X.subjInfo = el('p', 'nx-note', '', pf); X.subjInfo.hidden = true;
    X.mini = scroller(pf, T.miniCap); X.mini.hidden = true;

    // parameters panel
    var pp = panel('nx-par', T.parT);
    X.multi = el('div', 'nx-multi', null, pp); X.cells = [];
    for (var q = 0; q < 7; q++) { var c = el('div', 'nx-cell', null, X.multi); X.cells.push({ head: el('div', 'nx-cellh', '', c), box: c, svg: svgEl(c) }); }
    el('p', 'nx-note', T.parNote, pp);

    // objective panel (OFV curve + OFV surface side by side when wide)
    var po = panel('nx-obj', T.ofvT), ow = el('div', 'nx-obwrap', null, po), o1 = el('div', 'nx-o1', null, ow), o2 = el('div', 'nx-o2', null, ow);
    var tb2 = el('div', 'nx-toolbar', null, o1); el('span', 'nx-lbl', T.ofvLine, tb2);
    tog(T.dOfv, 'ofvLog', tb2, render);
    X.ofvBox = el('div', 'nx-chart', null, o1); X.ofvSvg = svgEl(X.ofvBox);
    el('p', 'nx-note', T.ofvNote, o1);
    var tb4 = el('div', 'nx-toolbar', null, o2); el('h4', 'nx-h4', T.cT, tb4);
    X.cBox = el('div', 'nx-chart', null, o2); X.cSvg = svgEl(X.cBox);
    X.cNote = el('p', 'nx-note', '', o2);

    // eta panel
    var pe = panel('nx-eta', T.etaT);
    var tb3 = el('div', 'nx-toolbar', null, pe); tog(T.showEta, 'showEta', tb3, render);
    X.etaBox = el('div', 'nx-chart', null, pe); X.etaSvg = svgEl(X.etaBox);
    X.shr = el('ul', 'nx-shr', null, pe);
    el('p', 'nx-note', T.etaNote, pe);

    // table
    var pt = el('section', 'nx-panel nx-tab', null, grid);
    var th = el('h3', 'nx-h3', T.tabT, pt); th.id = 'nx' + id + 'tab'; pt.setAttribute('aria-labelledby', th.id);
    var tw = scroller(pt, T.tabCap); X.table = el('table', 'nx-table', null, tw);
    el('caption', null, T.tabCap, X.table);
    buildTable();

    // details
    function det(title) { var d = el('details', 'nx-det', null, root); el('summary', null, title, d); return d; }
    var d1 = det(T.iterT), ol = el('ol', 'nx-ol', null, d1); T.iterSteps.forEach(function (s) { el('li', null, s, ol); });
    X.valDet = det(T.valT); buildValidation(X.valDet);
    var d3 = det(T.limT), ul = el('ul', 'nx-ul', null, d3); T.lim.forEach(function (s) { el('li', null, s, ul); });
    X.live = el('div', 'nx-sr', '', root); X.live.setAttribute('aria-live', 'polite'); X.live.setAttribute('role', 'status');

    /* ---------- table + validation (static, built from stored data) */
    function cellTxt(est, tru, d) { return num(est, d) + ' (' + sgn((est / tru - 1) * 100, 1) + '%)'; }
    function buildTable() {
      var t = X.table, hd = el('thead', null, null, t), tr = el('tr', null, null, hd);
      T.tabCols.forEach(function (c, i) { var h = el('th', null, c, tr); h.scope = 'col'; if (i > 1) h.dataset.scen = ['rich', 'moderate', 'sparse'][i - 2]; });
      var tb = el('tbody', null, null, t);
      var tr0 = truth.theta.concat(truth.omega, [truth.sigma]);
      for (var p = 0; p < 7; p++) {
        var row = el('tr', null, null, tb), h = el('th', null, T.pnames[p], row); h.scope = 'row';
        el('td', null, sig3(tr0[p]), row);
        ['rich', 'moderate', 'sparse'].forEach(function (k) {
          var f = data.scenarios[k].frames; f = f[f.length - 1]; var est = f.theta.concat(f.omega, [f.sigma])[p];
          var td = el('td', null, null, row); td.dataset.scen = k; el('span', 'nx-v', sig3(est), td); el('span', 'nx-pc', sgn((est / tr0[p] - 1) * 100, 1) + '%', td);
          var rse = data.scenarios[k].final.rse_pct; if (rse) el('span', 'nx-pc', 'RSE ' + num(rse[p], 1) + '%', td);
        });
      }
      for (var e = 0; e < 3; e++) {
        var r = el('tr', null, null, tb), hh = el('th', null, tpl(T.shrRow, { n: PCOL[e] }), r); hh.scope = 'row';
        el('td', null, '–', r);
        ['rich', 'moderate', 'sparse'].forEach(function (k) { var f = data.scenarios[k].frames; var td = el('td', null, num(shrinkage(f[f.length - 1], e) * 100, 1) + '%', r); td.dataset.scen = k; });
      }
      var ri = el('tr', null, null, tb), hi = el('th', null, T.itRow, ri); hi.scope = 'row'; el('td', null, '–', ri);
      ['rich', 'moderate', 'sparse'].forEach(function (k) { var td = el('td', null, String(data.scenarios[k].n_iter_total), ri); td.dataset.scen = k; });
    }
    function vTable(parent, label, cols, rows) {
      var w = scroller(parent, label), t = el('table', 'nx-table nx-small', null, w), tr = el('tr', null, null, el('thead', null, null, t));
      cols.forEach(function (c) { el('th', null, c, tr).scope = 'col'; });
      var tb = el('tbody', null, null, t);
      rows.forEach(function (r) { var q = el('tr', null, null, tb); r.forEach(function (c, i) { if (i === 0) el('th', null, c, q).scope = 'row'; else el('td', null, c, q); }); });
    }
    function buildValidation(d) {
      X.selfP = el('p', 'nx-p ' + (self.ok ? 'nx-okp' : 'nx-warn'), self.ok ? tpl(T.selfOk, { e: self.maxAbsErr.toExponential(1), n: self.nValues, c: self.checks.length }) : tpl(T.selfBad, { msg: self.failed.join('; ') }), d);
      var v = data.validation || {}, cc = data.crosscheck || {}, names = { rich: T.rich, moderate: T.moderate, sparse: T.sparse };
      if (cc.nlmixr2) el('p', 'nx-p', cc.nlmixr2.attempted ? T.vNlmFound : T.vNlm, d);
      if (v.jacobian_vs_finite_difference) { var j = v.jacobian_vs_finite_difference; el('p', 'nx-p', tpl(T.vJac, { n: j.n_parameter_sets, r: j.max_rel_err.toExponential(1) }), d); }
      var iv = v.inner_problem_vs_scipy_lbfgsb;
      if (iv) { var wd = 0; for (var k in iv) wd = Math.max(wd, iv[k].max_abs_eta_diff); el('p', 'nx-p', tpl(T.vInner, { d: wd.toExponential(1) }), d); }
      var ms = v.inner_problem_multistart;
      if (ms) {
        var ks = ['rich', 'moderate', 'sparse'], wd2 = 0, kk = [], ll = 0;
        ks.forEach(function (k) { wd2 = Math.max(wd2, ms[k].max_abs_ofv_diff_all_frames); kk.push(ms[k].final_flipflop_start_other_local_minimum_subjects); ll += ms[k].final_flipflop_start_lower_objective_subjects; });
        el('p', 'nx-p', tpl(T.vMulti, { d: sci(wd2), k: kk.join(' / '), l: ll }), d);
      }
      var lp = v.laplace_vs_bruteforce;
      if (lp) {
        el('p', 'nx-p', T.vLapT, d);
        vTable(d, T.vLapT, T.vLapCols, ['rich', 'moderate', 'sparse'].map(function (k) { var g = lp[k]; return [names[k], String(g.n_obs_per_subject), sgn(g.gap_mean, 3), sgn(g.gap_min, 3) + ' … ' + sgn(g.gap_max, 3), sgn(g.sum_gap, 2)]; }));
        if (lp.rich_at_start_values) { var s0 = lp.rich_at_start_values; el('p', 'nx-p', tpl(T.vLapStart, { m: sgn(s0.gap_mean, 2), a: sgn(s0.gap_min, 2), b: sgn(s0.gap_max, 2) }), d); }
      }
      var rs = v.independent_starts;
      if (rs) {
        el('p', 'nx-p', T.vRestT, d);
        vTable(d, T.vRestT, T.vRestCols, ['rich', 'moderate', 'sparse'].map(function (k) {
          var r = rs[k].runs, md = 0, mp = 0, ok = 0; r.forEach(function (x) { md = Math.max(md, Math.abs(x.d_ofv)); mp = Math.max(mp, x.max_rel_diff_pct); if (x.success) ok++; });
          return [names[k], md < 5e-5 ? '< 0.0001' : sci(md), mp <= 0.001 ? '\u2264 0.001' : num(mp, 3), ok + '/' + r.length];
        }));
      }
      var rp = v.replicate_study;
      if (rp) {
        var res = rp.results, n0 = res.rich.n_replicates;
        el('p', 'nx-p', tpl(T.vRepT, { n: n0 }), d);
        var rows = T.pnames.map(function (pn, p) { return [pn].concat(['rich', 'moderate', 'sparse'].map(function (k) { return sgn(res[k].median_err_pct[p], 1); })); });
        rows.push([T.vRepConv].concat(['rich', 'moderate', 'sparse'].map(function (k) { return res[k].n_converged + '/' + res[k].n_replicates; })));
        vTable(d, tpl(T.vRepT, { n: n0 }), T.vRepCols, rows);
      }
    }

    /* ---------- playback */
    function pause(announceIt) { S.playing = false; if (S.timer) { clearTimeout(S.timer); S.timer = null; } syncPlay(); if (announceIt) announce(); }
    function play() {
      if (reduceMq.matches) return;
      if (S.fi >= frames().length - 1) go(0, false);
      S.playing = true; syncPlay(); schedule();
    }
    function schedule() {
      S.timer = setTimeout(function () {
        if (!S.playing || !root.isConnected) return;
        if (S.fi < frames().length - 1) { go(S.fi + 1, false); if (S.fi >= frames().length - 1) pause(true); else schedule(); } else pause(true);
      }, 900 / S.speed);
    }
    function syncPlay() {
      X.play.textContent = S.playing ? T.pause : T.play;
      X.play.setAttribute('aria-pressed', S.playing ? 'true' : 'false');
    }
    function syncReduced() {
      var r = reduceMq.matches; X.reduced.hidden = !r; X.play.disabled = r; X.speed.disabled = r;
      if (r) pause();
    }
    function go(i, ann) { S.fi = Math.max(0, Math.min(frames().length - 1, i)); render(); if (ann) announce(); }
    function setScen(k) { if (k === S.scen) return; pause(); S.scen = k; S.fi = 0; X.slider.max = frames().length - 1; render(); announce(); }

    /* ---------- captions */
    function captionText() {
      var fs = frames(), f = fs[S.fi];
      if (S.fi === 0) return tpl(T.cap0, { ofv: num(f.ofv, 1), cl: num(f.theta[0], 2), v: num(f.theta[1], 1), ka: num(f.theta[2], 2) });
      var p = fs[S.fi - 1];
      return tpl(T.cap, { it: f.iter, pv: p.iter, ofv: num(f.ofv, 1), d: sgn(f.ofv - p.ofv, 1), a: num(p.theta[0], 2), b: num(f.theta[0], 2) }) + (S.fi === fs.length - 1 ? T.capEnd : '');
    }
    function announce() {
      var t = T.liveLbl + ': ' + T.scenLbl + ' ' + T[S.scen] + '. ' + captionText(), n = X.live;
      n.textContent = ''; setTimeout(function () { n.textContent = t; }, 30);
    }

    /* ---------- rendering */
    var fitRange = {};
    function ranges() {
      var all = [], i, k;
      for (k in data.scenarios) { /* same y-range for all scenarios keeps the chart comparable */
        var s = data.scenarios[k];
        for (i = 0; i < nS; i++) s.sampling[i].forEach(function (j) { all.push(subjects[i].y[j]); });
      }
      var mx = Math.max.apply(null, all), mn = Math.min.apply(null, all);
      fitRange.lin = [0, niceStep(mx * 1.12, 4) * Math.ceil(mx * 1.12 / niceStep(mx * 1.12, 4))];
      fitRange.log = [Math.pow(10, Math.floor(Math.log10(mn * 0.7))), Math.pow(10, Math.ceil(Math.log10(mx * 1.3)))];
      fitRange.tmax = data.times_rich[data.times_rich.length - 1];
    }
    ranges();

    function drawFit(W) {
      var fr = frame(), w = W, h = Math.max(250, Math.min(440, Math.round(W * 0.8))), m = { l: 50, r: 10, t: 8, b: 40 }, svg = X.fitSvg;
      setSvg(svg, w, h, tpl(T.fitAlt, { it: fr.iter }));
      var log = S.logY, yr = log ? fitRange.log : fitRange.lin, tmax = fitRange.tmax;
      var xs = lin(0, tmax, m.l, w - m.r), ys = log ? lin(Math.log(yr[0]), Math.log(yr[1]), h - m.b, m.t) : lin(yr[0], yr[1], h - m.b, m.t);
      var yv = function (v) { return log ? ys(Math.log(v)) : ys(v); };
      var cid = 'nx' + id + 'fc', defs = sv(svg, 'defs'), cp = sv(defs, 'clipPath', { id: cid }); sv(cp, 'rect', { x: m.l, y: m.t, width: w - m.l - m.r, height: h - m.t - m.b });
      axes(svg, { w: w, h: h, m: m, xs: xs, ys: yv, xt: thinTicks(linTicks(0, tmax, w < 420 ? 4 : 6), xs, 28), yt: log ? logTicks(yr[0], yr[1]).filter(function (v) { return v >= yr[0] && v <= yr[1]; }) : linTicks(yr[0], yr[1], 5), xl: T.xTime, yl: T.yConc });
      var g = sv(svg, 'g', { 'clip-path': 'url(#' + cid + ')' }), tg = [0], q;
      for (q = 0.25; q <= tmax + 1e-9; q += 0.25) tg.push(q);
      function curve(cl, v, ka) { return path(tg.map(function (t) { var f = conc(cl, v, ka, t, dose); return (log && !(f > 0)) ? null : [xs(t), yv(f)]; })); }
      if (S.showTrue) sv(g, 'path', { d: curve(truth.theta[0], truth.theta[1], truth.theta[2]), 'class': 'nx-tru' });
      var sel = S.subj - 1, i;
      for (i = 0; i < nS; i++) { var p = indiv(fr, i); sv(g, 'path', { d: curve(p[0], p[1], p[2]), 'class': 'nx-ind' + (sel >= 0 ? (i === sel ? ' nx-ind-sel' : ' nx-dim') : '') }); }
      if (sel >= 0 && S.showTrue) { var et = subjects[sel].eta_true; sv(g, 'path', { d: curve(truth.theta[0] * Math.exp(et[0]), truth.theta[1] * Math.exp(et[1]), truth.theta[2] * Math.exp(et[2])), 'class': 'nx-tru nx-tru-sel' }); }
      sv(g, 'path', { d: curve(fr.theta[0], fr.theta[1], fr.theta[2]), 'class': 'nx-pop' });
      for (i = 0; i < nS; i++) {
        obsOf(i).forEach(function (o) { if (log && !(o[1] > 0)) return; sv(g, 'circle', { cx: xs(o[0]).toFixed(1), cy: yv(o[1]).toFixed(1), r: (sel === i ? 4.2 : 2.8), 'class': 'nx-obs' + (sel >= 0 ? (sel === i ? ' nx-obs-sel' : ' nx-dim') : '') }); });
      }
    }

    function drawSubject() {
      var fr = frame(), sel = S.subj - 1;
      X.subjInfo.hidden = X.mini.hidden = sel < 0;
      if (sel < 0) return;
      var e = fr.eta[sel], p = indiv(fr, sel), et = subjects[sel].eta_true;
      X.subjInfo.textContent = tpl(T.subjInfo, { n: sel + 1, e: e.map(function (v) { return sgn(v, 2); }).join(', '), cl: num(p[0], 2), v: num(p[1], 1), ka: num(p[2], 2), t: et.map(function (v) { return sgn(v, 2); }).join(', ') });
      clear(X.mini);
      var t = el('table', 'nx-table nx-small', null, X.mini); el('caption', null, T.miniCap, t);
      var tr = el('tr', null, null, el('thead', null, null, t)); T.miniCols.forEach(function (c) { el('th', null, c, tr).scope = 'col'; });
      var tb = el('tbody', null, null, t);
      obsOf(sel).forEach(function (o) {
        var r = el('tr', null, null, tb);
        el('td', null, String(o[0]), r); el('td', null, num(o[1], 3), r);
        el('td', null, num(conc(p[0], p[1], p[2], o[0], dose), 3), r); el('td', null, num(conc(fr.theta[0], fr.theta[1], fr.theta[2], o[0], dose), 3), r);
      });
    }

    function drawOfv(W) {
      var fs = frames(), fr = frame(), w = W, h = Math.max(170, Math.min(240, Math.round(W * 0.44))), m = { l: 50, r: 12, t: 8, b: 36 }, svg = X.ofvSvg;
      setSvg(svg, w, h, tpl(T.ofvAlt, { it: fr.iter, v: num(fr.ofv, 1) }));
      var fin = fs[fs.length - 1].ofv, lg = S.ofvLog, vals = fs.map(function (f) { return lg ? Math.log10(Math.max(f.ofv - fin, 1e-3)) : f.ofv; });
      var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = (hi - lo) * 0.06 || 1;
      var xs = lin(0, Math.max(1, fs[fs.length - 1].iter), m.l, w - m.r), ys = lin(lo - pad, hi + pad, h - m.b, m.t);
      var yt = lg ? linTicks(lo - pad, hi + pad, 4).filter(function (v) { return Math.abs(v - Math.round(v)) < 1e-9; }) : linTicks(lo - pad, hi + pad, 4);
      if (lg && yt.length < 2) yt = [Math.ceil(lo), Math.floor(hi)];
      axes(svg, { w: w, h: h, m: m, xs: xs, ys: ys, xt: thinTicks(linTicks(0, fs[fs.length - 1].iter, 6), xs, 28), yt: yt, yf: lg ? function (v) { return '10' + sup(v); } : tickFmt, xl: T.xIter, yl: lg ? T.dOfv : 'OFV' });
      var pts = fs.map(function (f, i) { return [xs(f.iter), ys(vals[i])]; });
      sv(svg, 'path', { d: path(pts), 'class': 'nx-line-f' });
      sv(svg, 'path', { d: path(pts.slice(0, S.fi + 1)), 'class': 'nx-line' });
      pts.forEach(function (p, i) { sv(svg, 'circle', { cx: p[0], cy: p[1], r: i === S.fi ? 5 : 2.3, 'class': i === S.fi ? 'nx-cur' : (i < S.fi ? 'nx-dot' : 'nx-dot nx-dim2') }); });
    }
    function sup(v) { var s = String(Math.round(v)), m = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }; return s.split('').map(function (c) { return m[c] || c; }).join(''); }

    function contourSegs(Z, n, level, xAt, yAt) {
      var segs = [], i, j;
      function itp(va, vb, a, b) { var t = (level - va) / (vb - va); return a + t * (b - a); }
      for (i = 0; i < n - 1; i++) for (j = 0; j < n - 1; j++) {
        var a = Z[i][j], b = Z[i][j + 1], c = Z[i + 1][j + 1], d = Z[i + 1][j];
        var idx = (a > level ? 1 : 0) | (b > level ? 2 : 0) | (c > level ? 4 : 0) | (d > level ? 8 : 0);
        if (idx === 0 || idx === 15) continue;
        var x0 = xAt(j), x1 = xAt(j + 1), y0 = yAt(i), y1 = yAt(i + 1);
        var E = { B: [itp(a, b, x0, x1), y0], R: [x1, itp(b, c, y0, y1)], T: [itp(d, c, x0, x1), y1], L: [x0, itp(a, d, y0, y1)] };
        var center = (a + b + c + d) / 4 > level, tbl = {
          1: ['LB'], 2: ['BR'], 3: ['LR'], 4: ['RT'], 5: center ? ['BR', 'LT'] : ['LB', 'RT'], 6: ['BT'], 7: ['LT'], 8: ['LT'], 9: ['BT'],
          10: center ? ['LB', 'RT'] : ['BR', 'LT'], 11: ['RT'], 12: ['LR'], 13: ['BR'], 14: ['LB']
        };
        tbl[idx].forEach(function (s) { segs.push([E[s[0]], E[s[1]]]); });
      }
      return segs;
    }

    function drawContour(W) {
      var s = scen(), sf = s.surface, fs = frames(), fr = frame(), w = W, h = Math.max(240, Math.min(360, Math.round(W * 0.82))), m = { l: 50, r: 12, t: 8, b: 38 }, svg = X.cSvg;
      setSvg(svg, w, h, tpl(T.cAlt, { it: fr.iter }));
      var n = sf.n, hw = sf.half_width, c0 = sf.centre, lx = [], ly = [];
      var lnx = function (j) { return c0[0] + (j / (n - 1) * 2 - 1) * hw; }, lny = function (i) { return c0[1] + (i / (n - 1) * 2 - 1) * hw; };
      var px = fs.map(function (f) { return Math.log(f.theta[0]); }), py = fs.map(function (f) { return Math.log(f.theta[1]); });
      var x0 = Math.min(c0[0] - hw, Math.min.apply(null, px)), x1 = Math.max(c0[0] + hw, Math.max.apply(null, px));
      var y0 = Math.min(c0[1] - hw, Math.min.apply(null, py)), y1 = Math.max(c0[1] + hw, Math.max.apply(null, py));
      var pdx = (x1 - x0) * 0.04, pdy = (y1 - y0) * 0.04; x0 -= pdx; x1 += pdx; y0 -= pdy; y1 += pdy;
      var xs = lin(x0, x1, m.l, w - m.r), ys = lin(y0, y1, h - m.b, m.t);
      axes(svg, {
        w: w, h: h, m: m, xs: xs, ys: ys, noGrid: true, xl: 'CL/F (L/h)', yl: 'V/F (L)',
        xt: thinTicks(logTicks(Math.exp(x0), Math.exp(x1)).map(Math.log), xs, 30), yt: thinTicks(logTicks(Math.exp(y0), Math.exp(y1)).map(Math.log), ys, 22),
        xf: function (v) { return tickFmt(Math.exp(v)); }, yf: function (v) { return tickFmt(Math.exp(v)); }
      });
      var gx = xs(c0[0] - hw), gy = ys(c0[1] + hw);
      sv(svg, 'rect', { x: gx, y: gy, width: xs(c0[0] + hw) - gx, height: ys(c0[1] - hw) - gy, 'class': 'nx-surf' });
      var mn = Infinity, mx = -Infinity; sf.z.forEach(function (r) { r.forEach(function (v) { if (v < mn) mn = v; if (v > mx) mx = v; }); });
      var lv = [], d = 1; while (d < mx - mn) { lv.push(d); d *= 2; } lv.push(d);
      var cx = function (j) { return xs(lnx(j)); }, cy = function (i) { return ys(lny(i)); };
      lv.forEach(function (L, k) {
        var segs = contourSegs(sf.z, n, mn + L, cx, cy), dd = segs.map(function (q) { return 'M' + q[0][0].toFixed(1) + ' ' + q[0][1].toFixed(1) + 'L' + q[1][0].toFixed(1) + ' ' + q[1][1].toFixed(1); }).join('');
        if (dd) sv(svg, 'path', { d: dd, 'class': 'nx-ct', style: 'opacity:' + (1 - 0.6 * k / Math.max(1, lv.length - 1)).toFixed(2) });
      });
      X.cNote.textContent = tpl(T.cNote, { lv: lv.join(', ') });
      var pts = fs.map(function (f, i) { return [xs(px[i]), ys(py[i])]; });
      sv(svg, 'path', { d: path(pts.slice(0, S.fi + 1)), 'class': 'nx-pth' });
      sv(svg, 'circle', { cx: pts[0][0], cy: pts[0][1], r: 4.5, 'class': 'nx-start' });
      var fin = pts[pts.length - 1];
      sv(svg, 'path', { d: 'M' + (fin[0] - 4.5) + ' ' + (fin[1] - 4.5) + 'l9 9m0-9l-9 9', 'class': 'nx-fin' });
      sv(svg, 'circle', { cx: pts[S.fi][0], cy: pts[S.fi][1], r: 5.5, 'class': 'nx-cur' });
      var lab = function (p, t, dx) { sv(svg, 'text', { x: Math.min(Math.max(p[0] + dx, m.l + 2), w - m.r - 2), y: p[1] - 9, 'text-anchor': dx < 0 ? 'end' : 'start', 'class': 'nx-tk nx-tkb' }, t); };
      lab(pts[0], T.cStart, 8); lab(fin, T.cEnd, -8);
    }

    function drawParams() {
      var fs = frames(), fr = frame(), tr = truth.theta.concat(truth.omega, [truth.sigma]), st = data.start;
      X.cells.forEach(function (c, p) {
        var vals = fs.map(function (f) { return f.theta.concat(f.omega, [f.sigma])[p]; }), cur = vals[S.fi];
        var w = Math.max(120, c.box.clientWidth || 140), h = 96, m = { l: 38, r: 8, t: 6, b: 22 };
        c.head.textContent = T.pnames[p] + ': ' + sig3(cur) + ' (' + T.truthWord + ' ' + sig3(tr[p]) + ')';
        setSvg(c.svg, w, h, tpl(T.parAlt, { n: T.pnames[p], v: sig3(cur), it: fr.iter, t: sig3(tr[p]) }));
        var all = vals.concat([tr[p]]), lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), lg = lo > 0 && hi / lo > 30;
        var f = lg ? Math.log : function (v) { return v; };
        var a = f(lo), b = f(hi), pad = (b - a) * 0.12 || 0.1;
        var xs = lin(0, Math.max(1, fs[fs.length - 1].iter), m.l, w - m.r), ys0 = lin(a - pad, b + pad, h - m.b, m.t), ys = function (v) { return ys0(f(v)); };
        var yt = lg ? thinTicks(logTicks(lo, hi), ys, 20) : linTicks(a - pad, b + pad, 2).filter(function (v) { return v >= a - pad && v <= b + pad; });
        axes(c.svg, { w: w, h: h, m: m, xs: xs, ys: ys, xt: [0, fs[fs.length - 1].iter], yt: yt, noGrid: false });
        sv(c.svg, 'line', { x1: m.l, x2: w - m.r, y1: ys(tr[p]), y2: ys(tr[p]), 'class': 'nx-truth' });
        var pts = vals.map(function (v, i) { return [xs(fs[i].iter), ys(v)]; });
        sv(c.svg, 'path', { d: path(pts), 'class': 'nx-line-f' });
        sv(c.svg, 'path', { d: path(pts.slice(0, S.fi + 1)), 'class': 'nx-line' });
        sv(c.svg, 'circle', { cx: pts[S.fi][0], cy: pts[S.fi][1], r: 4.5, 'class': 'nx-cur' });
      });
    }

    function drawEta(W) {
      var fs = frames(), fr = frame(), w = W, rowH = 50, h = rowH * 3 + 38, m = { l: 48, r: 12, t: 4, b: 34 }, svg = X.etaSvg;
      var shs = [0, 1, 2].map(function (k) { return shrinkage(fr, k); });
      setSvg(svg, w, h, tpl(T.etaAlt, { it: fr.iter, s: shs.map(function (v, k) { return PCOL[k] + ' ' + num(v * 100, 0) + '%'; }).join(', ') }));
      var R = 0.8; fs.forEach(function (f) { f.eta.forEach(function (e) { e.forEach(function (v) { R = Math.max(R, Math.abs(v)); }); }); f.omega.forEach(function (o) { R = Math.max(R, 2.1 * o); }); });
      subjects.forEach(function (s) { s.eta_true.forEach(function (v) { R = Math.max(R, Math.abs(v)); }); });
      R = Math.ceil(R * 5) / 5;
      var xs = lin(-R, R, m.l, w - m.r);
      sv(svg, 'text', { x: (m.l + w - m.r) / 2, y: h - 4, 'text-anchor': 'middle', 'class': 'nx-al' }, 'η̂ (log scale)');
      var xt = thinTicks(linTicks(-R, R, 6), xs, 30);
      xt.forEach(function (v) { sv(svg, 'line', { x1: xs(v), x2: xs(v), y1: m.t, y2: h - m.b, 'class': v === 0 ? 'nx-ax' : 'nx-gl' }); sv(svg, 'text', { x: xs(v), y: h - m.b + 15, 'text-anchor': 'middle', 'class': 'nx-tk' }, tickFmt(v)); });
      var sel = S.subj - 1;
      for (var k = 0; k < 3; k++) {
        var y0 = m.t + k * rowH, cy = y0 + rowH / 2, o2 = 2 * fr.omega[k];
        sv(svg, 'rect', { x: xs(-o2), y: y0 + 4, width: xs(o2) - xs(-o2), height: rowH - 8, 'class': 'nx-band' });
        sv(svg, 'text', { x: m.l - 6, y: cy + 4, 'text-anchor': 'end', 'class': 'nx-tk nx-tkb' }, PCOL[k]);
        for (var i = 0; i < nS; i++) {
          var jit = ((i * 7) % 5 - 2) * 4.2;
          if (S.showEta) sv(svg, 'path', { d: 'M' + xs(subjects[i].eta_true[k]).toFixed(1) + ' ' + (y0 + 6) + 'v7', 'class': 'nx-trueeta' });
          var c = sv(svg, 'circle', { cx: xs(fr.eta[i][k]).toFixed(1), cy: (cy + jit + (S.showEta ? 4 : 0)).toFixed(1), r: sel === i ? 5 : 3.2, 'class': 'nx-edot' + (sel === i ? ' nx-edot-sel' : '') });
          c.setAttribute('data-i', i + 1);
          sv(c, 'title', null, tpl(T.subj, { n: i + 1 }) + ': ' + PCOL[k] + ' η̂ ' + sgn(fr.eta[i][k], 2));
        }
      }
      clear(X.shr);
      shs.forEach(function (v, k) { el('li', null, T.shr + ' ' + PCOL[k] + ': ' + num(v * 100, 1) + '%', X.shr); });
    }

    function render() {
      var fs = frames(), fr = frame(), s = scen();
      X.slider.max = fs.length - 1; X.slider.value = S.fi;
      X.slider.setAttribute('aria-valuetext', tpl(T.frameLbl, { it: fr.iter, k: S.fi + 1, n: fs.length }));
      X.frameLbl.textContent = tpl(T.frameLbl, { it: fr.iter, k: S.fi + 1, n: fs.length });
      for (var k in X.segBtn) X.segBtn[k].setAttribute('aria-pressed', k === S.scen ? 'true' : 'false');
      Array.prototype.forEach.call(X.table.querySelectorAll('[data-scen]'), function (c) { c.classList.toggle('nx-selcol', c.dataset.scen === S.scen); });
      X.note.textContent = (s.thinned ? tpl(T.thinYes, { f: fs.length, n: s.n_iter_total }) : tpl(T.thinNo, { n: s.n_iter_total })) + ' ' +
        tpl(s.final.optimiser_success ? T.stopOk : T.stopBad, { n: s.final.n_iter, msg: lang === 'en' ? s.final.termination.replace(/\.$/, '') : (s.final.optimiser_success ? '성공' : '실패'), g: s.final.max_abs_gradient.toExponential(1) });
      X.caption.textContent = captionText();
      var wf = X.fitBox.clientWidth, wo = X.ofvBox.clientWidth, wc = X.cBox.clientWidth, we = X.etaBox.clientWidth;
      if (wf > 40) drawFit(wf);
      if (wo > 40) drawOfv(wo);
      if (wc > 40) drawContour(wc);
      if (we > 40) drawEta(we);
      drawParams(); drawSubject();
    }

    X.etaSvg.addEventListener('click', function (e) {
      var t = e.target; if (t && t.getAttribute && t.getAttribute('data-i')) { S.subj = +t.getAttribute('data-i'); X.subj.value = S.subj; render(); announce(); }
    });

    /* ---------- lifecycle */
    syncPlay(); syncReduced();
    if (reduceMq.addEventListener) reduceMq.addEventListener('change', syncReduced);
    document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });
    var lastW = 0;
    function relayout() { var w = root.clientWidth; if (w && Math.abs(w - lastW) > 1) { lastW = w; render(); } }
    if (window.ResizeObserver) new ResizeObserver(relayout).observe(root); else window.addEventListener('resize', relayout);
    render();
    return { selfTest: self, state: S, render: render, data: data };
  }

  /* ------------------------------------------------------------------ mounting */
  var mounted = new WeakMap(), firstData = null, firstSrc = null;
  function pickLang(el) {
    var l = (el.getAttribute('data-lang') || document.documentElement.lang || 'en').toLowerCase();
    return l.indexOf('ko') === 0 ? 'ko' : 'en';
  }
  function mount(root) {
    if (!root || mounted.has(root)) return mounted.get(root) || Promise.resolve();
    var lang = pickLang(root), src = root.getAttribute('data-src');
    var p = (function () {
      root.classList.add('nx-root');
      root.textContent = TXT[lang].loading;
      if (!src) { root.textContent = TXT[lang].fail; return Promise.reject(new Error('data-src missing')); }
      return fetch(new URL(src, document.baseURI).href).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (data) {
        if (!firstData) firstData = data;
        return build(root, data, lang);
      });
    })();
    p = p.catch(function (err) { root.textContent = TXT[lang].fail; if (window.console) console.warn('nlme-explorer:', err && err.message); });
    mounted.set(root, p);
    return p;
  }
  function nlmeSelfTest(arg) {
    function run(d) { return selfTest(d); }
    if (arg && typeof arg === 'object') return Promise.resolve(run(arg));
    if (typeof arg === 'string') return fetch(new URL(arg, document.baseURI).href).then(function (r) { return r.json(); }).then(run);
    if (firstData) return Promise.resolve(run(firstData));
    var n = document.querySelector('[data-lab-widget="' + NAME + '"]');
    if (n && n.getAttribute('data-src')) return nlmeSelfTest(n.getAttribute('data-src'));
    return Promise.reject(new Error('no data'));
  }

  var LW = window.LabWidgets = window.LabWidgets || {};
  var prevMount = LW.mount;
  LW.mount = function (el) {
    if (el && el.getAttribute && el.getAttribute('data-lab-widget') === NAME) return mount(el);
    return prevMount ? prevMount.apply(this, arguments) : undefined;
  };
  LW.nlmeSelfTest = nlmeSelfTest;

  function init() {
    var nodes = document.querySelectorAll('[data-lab-widget="' + NAME + '"]');
    Array.prototype.forEach.call(nodes, function (n) {
      if (!('IntersectionObserver' in window)) { mount(n); return; }
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); mount(n); } }); }, { rootMargin: '300px' });
      io.observe(n);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
