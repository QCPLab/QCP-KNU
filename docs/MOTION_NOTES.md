# Research-in-motion figures: notes

Six small animated figures (`assets/js/research-motion.js`, `assets/css/research-motion.css`); captions are in `_src/i18n/{en,ko}.yml` (`motion.scenes`).
Everything is simulated; nothing is laboratory data. Each figure computes what it draws from the equations below (no hand-keyed curves).

| Fig. | Content | Model / data | Checked by `LabMotion.selfTest()` |
|---|---|---|---|
| 1 pk | linear and semilog concentration-time curves, AUC filling in, compartment bars, parameter table | one compartment, first-order absorption and elimination, ka 1.0 1/h, ke 0.20 (0.10) 1/h, dose = volume = 1 | closed form = RK4 of the ODEs; AUC = 1/ke; eliminated share = AUC(0-t)/AUC(0-inf) |
| 2 metabolism | pathway with rate-proportional arrows, stacked mass balance | parent -> metabolite -> eliminated, k1 0.36 (0.09) 1/h, k2 0.18 1/h, IV bolus | closed form = ODE |
| 3 transport | transporter sites, plasma curve, AUC ratio against [I]/Ki | saturable uptake, competitive inhibitor at constant [I]/Ki, Vmax 0.5 1/h, Km 0.8, C0 1 (RK4, dt 0.01 h) | mass balance C + U = 1; closed-form AUC (Km(1+[I]/Ki)+C0/2)/Vmax = numeric; v = Vmax x occupancy |
| 4 modeling | fit and prediction, sum-of-squares landscape with the optimiser path | 9 simulated concentrations (log-normal error 8 %, seed 20241014), Levenberg-Marquardt on log residuals, profile over ka for the contours | monotone decrease; parameters near truth; profile at the optimum equals the fitted sum of squares |
| 5 nlme | replay of a FOCE-I run on 30 simulated subjects: individual and population curves, OFV, estimates, etas, 90 % prediction interval | `assets/data/nlme-demo.json` (made by `tools/nlme_demo.py`, see `docs/NLME_NOTES.md` for validation); prediction interval from 240 simulated subjects with the current theta and omega | last frame = reported final estimates; OFV non-increasing; band ordered |
| 6 bioanalysis | instrument chain, chromatogram with integrated peaks, weighted calibration, back-calculation | exponentially modified Gaussian peaks, 1/x^2 weighted calibration, six calibrators | back-calculated concentration within 8 % of the set value |

## Limits stated in the captions
- Fig. 1-3, 6 use idealised models (IV bolus or complete absorption, constant inhibitor concentration, no other elimination); halving clearance leaves the volume unchanged.
- Fig. 4 fits one subject; it is not a population analysis. The contours are the sum of squares minimised over ka at each grid point (the ka/ke flip-flop branch is excluded); the path is projected onto the CL/F-V/F plane and the positions between accepted steps are interpolated.
- Fig. 5 shows one data set per sampling design (not an average over repetitions); the 90 % band includes between-subject variability only. FOCE-I is an approximation of the marginal likelihood; the comparison with nlmixr2/NONMEM was not made (see `docs/NLME_NOTES.md`, open items).
- Fig. 3 panel C: the cut-offs 1.25, 2 and 5 are the AUC-ratio limits used to classify CYP inhibitors as weak, moderate or strong (e.g. Kovarik et al., Biopharm Drug Dispos 2006 for CYP3A; Kosugi et al., Xenobiotica 2012; Yu et al., Drug Metab Dispos 2021). They are drawn as a scale only; the model is a transporter model with a simplified IV bolus. DOIs were not retrieved in this session (GAP).
- Fig. 6: the calibrator ratios come from a straight line with 3 % error, not from chromatograms; matrix effects and recovery are not modelled.
