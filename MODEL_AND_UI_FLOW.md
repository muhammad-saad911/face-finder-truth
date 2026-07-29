# Model and UI Flow

This document explains how the backend and frontend work together, which files own each step, and how the three video models are combined into one final result.

## High-Level Flow

1. The frontend uploads an image or video file.
2. The frontend sends the file to the backend `POST /detect/image` or `POST /detect/video`.
3. The backend extracts frames, detects faces, runs the three models, and combines their scores.
4. The backend returns one final verdict plus per-model video breakdown fields.
5. The frontend renders the final verdict and the individual model results for video scans.

## Repository Map

### Backend

- [`app/main.py`](D:/my%20projects/saad/backend/app/main.py): FastAPI app bootstrap.
- [`app/routes.py`](D:/my%20projects/saad/backend/app/routes.py): API endpoints for auth and detection.
- [`app/video_processor.py`](D:/my%20projects/saad/backend/app/video_processor.py): Video frame extraction, face cropping, and aggregation handoff.
- [`app/predictor.py`](D:/my%20projects/saad/backend/app/predictor.py): Loads the models and runs inference.
- [`app/config.py`](D:/my%20projects/saad/backend/app/config.py): Model paths and runtime settings.
- [`app/schemas.py`](D:/my%20projects/saad/backend/app/schemas.py): Pydantic response models.
- [`app/face_detector.py`](D:/my%20projects/saad/backend/app/face_detector.py): Face detection and cropping helpers.
- [`app/image_utils.py`](D:/my%20projects/saad/backend/app/image_utils.py): Image decoding helpers.

### Frontend

- [`src/lib/backendDetector.ts`](D:/my%20projects/saad/face-finder-truth/src/lib/backendDetector.ts): Parses backend responses and normalizes the values for the UI.
- [`src/pages/Index.tsx`](D:/my%20projects/saad/face-finder-truth/src/pages/Index.tsx): Main scan page, upload flow, and video model breakdown display.
- [`src/components/ResultCard.tsx`](D:/my%20projects/saad/face-finder-truth/src/components/ResultCard.tsx): Shared result card component and `AnalysisResult` type.
- [`src/lib/analysisHistory.ts`](D:/my%20projects/saad/face-finder-truth/src/lib/analysisHistory.ts): Saves the final scan summary for history.
- [`src/lib/deepfakeDetector.ts`](D:/my%20projects/saad/face-finder-truth/src/lib/deepfakeDetector.ts): Separate browser-side detector, not part of the active backend scan path.
- [`src/lib/audioDeepfakeDetector.ts`](D:/my%20projects/saad/face-finder-truth/src/lib/audioDeepfakeDetector.ts): Separate browser-side audio detector, not part of the active backend scan path.

## Backend Detection Flow

### 1. Request Entry

The video endpoint is [`POST /detect/video`](D:/my%20projects/saad/backend/app/routes.py). The route:

- validates the upload
- saves the incoming video to a temporary file
- calls [`process_video()`](D:/my%20projects/saad/backend/app/video_processor.py)
- returns a [`VideoResponse`](D:/my%20projects/saad/backend/app/schemas.py)

### 2. Video Sampling

[`app/video_processor.py`](D:/my%20projects/saad/backend/app/video_processor.py) does the video preprocessing:

- opens the video with OpenCV
- samples every `FRAME_SKIP` frames
- detects the largest face in each sampled frame
- crops the face region
- keeps up to `VIDEO_FRAMES` face crops

If there are more face crops than the target frame count, the code spreads the samples evenly across the clip.

### 3. Model Loading

[`app/config.py`](D:/my%20projects/saad/backend/app/config.py) defines the model locations:

- `VIDEO_MODEL_PATH` -> `model/pytorch_model.bin`
- `VIDEO_MODEL2_PATH` -> `model/model2`
- `VIDEO_MODEL3_PATH` -> `model/model3`

The three video models are loaded in [`app/predictor.py`](D:/my%20projects/saad/backend/app/predictor.py):

- `_load_video_model()`
- `_load_video_model_2()`
- `_load_video_model_3()`

## Model 1

### File and Architecture

- Model file: `model/pytorch_model.bin`
- Loader: `_load_video_model()`
- Backbone: `EfficientNet-B2`

### Input

- Each sampled face crop is resized to `260 x 260`
- Normalization uses ImageNet mean/std

### Inference

- `_score_video_variant()` runs the model on each crop
- The per-frame scores are aggregated by `_aggregate_video_scores()`

### Output Meaning

- `model1_prediction`: `"FAKE"` or `"REAL"`
- `model1_confidence`: model certainty score from the aggregated frame scores
- `model1_fake_probability`: fake probability as a percentage in the frontend
- `model1_real_probability`: real probability as a percentage in the frontend
- `model1_fake_frames`: frame-level votes for fake
- `model1_real_frames`: frame-level votes for real

## Model 2

### File and Architecture

- Model folder: `model/model2`
- Loader: `_load_video_model_2()`
- Backbone: `ViTForImageClassification`

### Input

- Each sampled face crop is processed with the Hugging Face image processor from `model/model2`
- The processor uses the model’s local `preprocessor_config.json`

### Inference

- `_score_video_variant_2()` runs the ViT model on each crop
- The per-frame scores are aggregated the same way as Model 1

### Output Meaning

- `model2_prediction`
- `model2_confidence`
- `model2_fake_probability`
- `model2_real_probability`
- `model2_fake_frames`
- `model2_real_frames`

## Model 3

### File and Architecture

- Model folder: `model/model3`
- Loader: `_load_video_model_3()`
- Backbone: `VideoMAEForVideoClassification`

### Input

- Uses the full sampled clip instead of single-frame crops
- The clip is normalized to the model’s `num_frames` value, which is `16`
- Frames are resized to the model’s `image_size`, which is `224`
- The input tensor is built manually in `_score_video_clip_3()` to avoid the NumPy-backed processor path

### Inference

- `_score_video_clip_3()` runs the clip once through VideoMAE
- The backend reads the `fake` and `real` labels from the model config

### Output Meaning

- `model3_prediction`
- `model3_confidence`
- `model3_fake_probability`
- `model3_real_probability`

Model 3 is clip-level, so it does not report per-frame fake/real counts.

## Model References

This section lists the concrete backend references for each model, including the local files that load them and the source metadata available in the repo.

### Model 1 Reference

- Local weights: [`model/pytorch_model.bin`](D:/my%20projects/saad/backend/model/pytorch_model.bin)
- Backend loader: [`app/predictor.py`](D:/my%20projects/saad/backend/app/predictor.py)
- Documented architecture: `EfficientNet-B2`
- Project README: [`model/README.md`](D:/my%20projects/saad/backend/model/README.md)
- External dataset reference: https://huggingface.co/datasets/ThinothW/Deepfake-Identity-Isolated-Dataset-PreP
- External project reference: https://github.com/thinothw/DFDS-Final-Project

### Model 2 Reference

- Local model folder: [`model/model2`](D:/my%20projects/saad/backend/model/model2)
- Backend loader: [`app/predictor.py`](D:/my%20projects/saad/backend/app/predictor.py)
- Architecture from config: `ViTForImageClassification`
- Model type from config: `vit`
- Label map from config: `0 -> Real`, `1 -> Fake`
- Processor file: [`model/model2/preprocessor_config.json`](D:/my%20projects/saad/backend/model/model2/preprocessor_config.json)
- Checkpoint config: [`model/model2/config.json`](D:/my%20projects/saad/backend/model/model2/config.json)
- Notes: this checkpoint is a local export, so the repo does not embed an external hub URL for it.

### Model 3 Reference

- Local model folder: [`model/model3`](D:/my%20projects/saad/backend/model/model3)
- Backend loader: [`app/predictor.py`](D:/my%20projects/saad/backend/app/predictor.py)
- Architecture from config: `VideoMAEForVideoClassification`
- Model type from config: `videomae`
- Label map from config: `0 -> real`, `1 -> fake`
- Processor file: [`model/model3/preprocessor_config.json`](D:/my%20projects/saad/backend/model/model3/preprocessor_config.json)
- Checkpoint config: [`model/model3/config.json`](D:/my%20projects/saad/backend/model/model3/config.json)
- Notes: this checkpoint is a local export, so the repo does not embed an external hub URL for it.

## Final Ensemble Result

The final video result returned by the backend is produced in [`predict_video_clip()`](D:/my%20projects/saad/backend/app/predictor.py).

### Current Combination Logic

1. Model 1 scores every sampled face crop.
2. Model 2 scores every sampled face crop.
3. Model 3 scores the full clip once.
4. Model 1 and Model 2 each produce an aggregated fake probability from their frame scores.
5. The final fake probability is blended as:

   - `35%` Model 1
   - `35%` Model 2
   - `30%` Model 3

6. The final label becomes `FAKE` or `REAL` using the combined score and threshold checks.
7. The backend computes confidence from the combined vote margin, decisiveness, and agreement.

### Final Video Fields

Returned by [`VideoResponse`](D:/my%20projects/saad/backend/app/schemas.py):

- `prediction`
- `confidence`
- `frames_analyzed`
- `fake_frames`
- `real_frames`
- `fake_probability`
- `real_probability`
- `model1_*`
- `model2_*`
- `model3_*`
- `model`

## Frontend Flow

### 1. Upload and API Call

[`src/pages/Index.tsx`](D:/my%20projects/saad/face-finder-truth/src/pages/Index.tsx) handles the upload UI and calls [`analyzeWithBackend()`](D:/my%20projects/saad/face-finder-truth/src/lib/backendDetector.ts).

### 2. Response Parsing

[`src/lib/backendDetector.ts`](D:/my%20projects/saad/face-finder-truth/src/lib/backendDetector.ts):

- parses the backend JSON
- preserves the final `fake_probability` and `real_probability`
- converts backend probabilities to frontend percentages when needed
- stores the per-model fields for video scans

### 3. Result Rendering

[`src/pages/Index.tsx`](D:/my%20projects/saad/face-finder-truth/src/pages/Index.tsx) renders:

- the final verdict
- the final deepfake probability
- the final confidence
- the `AI-generated signal` / real-content bars
- the three-model breakdown for video scans

[`src/components/ResultCard.tsx`](D:/my%20projects/saad/face-finder-truth/src/components/ResultCard.tsx) defines the shared `AnalysisResult` type and the visual result card layout.

## Probability Semantics

- `deepfake_probability`
  - final combined fake probability shown to the user
  - in backend responses it is expressed as `0..1` for raw model values, and the frontend displays it as `0..100`
- `real_probability`
  - complement of the final combined fake probability
- `confidence`
  - confidence score for the final ensemble or model
- `model1_confidence`, `model2_confidence`, `model3_confidence`
  - model-specific confidence scores for each model card
- `fake_frames` / `real_frames`
  - final combined frame-vote counts
- `model1_fake_frames` / `model1_real_frames`
  - Model 1 frame votes
- `model2_fake_frames` / `model2_real_frames`
  - Model 2 frame votes
- `model3_*`
  - VideoMAE clip-level outputs, no frame counts

## Saved History

[`src/lib/analysisHistory.ts`](D:/my%20projects/saad/face-finder-truth/src/lib/analysisHistory.ts) currently stores the final scan summary:

- verdict
- deepfake probability
- confidence
- AI / real probability
- summary and observations
- backend name
- model name

It does not currently persist the three per-model breakdown fields. If you want the history panel to show them later, extend `SavedAnalysis` and the save/load payloads in that file.

## Important Notes

- The active backend scan path is the FastAPI backend, not the browser-only detectors.
- The in-browser files in `src/lib/deepfakeDetector.ts` and `src/lib/audioDeepfakeDetector.ts` are separate helpers and are not part of the current upload-to-backend flow.
- The frontend breakdown cards show what each model predicted, but the final verdict comes from the backend ensemble.

## If You Want To Change Something

- Add or replace a video model:
  - backend: `app/config.py`, `app/predictor.py`, `app/schemas.py`
- Change how the final score is combined:
  - backend: `app/predictor.py`
- Change what the UI shows:
  - frontend: `src/pages/Index.tsx`, `src/components/ResultCard.tsx`, `src/lib/backendDetector.ts`
- Save more fields in history:
  - frontend: `src/lib/analysisHistory.ts`

