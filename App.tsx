import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, Dimensions } from "react-native";
import {
  Camera,
  useCameraDevice,
  useFrameProcessor,
} from "react-native-vision-camera";
import {
  Face,
  useFaceDetector,
  FaceDetectionOptions,
} from "react-native-vision-camera-face-detector";
import { Worklets } from "react-native-worklets-core";

const { width, height } = Dimensions.get("window");
const CIRCLE_RADIUS = width * 0.4;

export default function App() {
  const [faceDetectedInCircle, setFaceDetectedInCircle] = useState(false);
  const [step, setStep] = useState(1); // Step 1: Face detected, Step 2: Blink left eye, Step 3: Blink right eye
  const [blinkStatus, setBlinkStatus] = useState({
    leftEye: false,
    rightEye: false,
  });

  const faceDetectionOptions = useRef<FaceDetectionOptions>({
    performanceMode: "fast",
    landmarkMode: "none",
    classificationMode: "none",
    contourMode: "none",
  }).current;

  const device = useCameraDevice("front");
  const { detectFaces } = useFaceDetector(faceDetectionOptions);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      console.log({ status });
    })();
  }, []);

  // Define a threshold to consider an eye blinked
  const BLINK_THRESHOLD = 0.3; // Probability below this value means eye is blinked

  const handleDetectedFaces = Worklets.createRunOnJS((faces: Face[]) => {
    if (faces.length > 0) {
      const face = faces[0];
      const faceCenterX = face.bounds.x + face.bounds.width / 2;
      const faceCenterY = face.bounds.y + face.bounds.height / 2;

      const circleCenterX = width / 2;
      const circleCenterY = height / 2;

      const distance = Math.sqrt(
        Math.pow(faceCenterX - circleCenterX, 2) +
          Math.pow(faceCenterY - circleCenterY, 2)
      );

      const isInsideCircle = distance < CIRCLE_RADIUS;
      setFaceDetectedInCircle(isInsideCircle);

      // After face detection, proceed with blink detection
      if (isInsideCircle) {
        if (step === 1 && face.leftEyeOpenProbability < BLINK_THRESHOLD) {
          // Blink left eye detected
          setBlinkStatus((prev) => ({ ...prev, leftEye: true }));
          setStep(2); // Move to right eye blink step
        } else if (
          step === 2 &&
          face.rightEyeOpenProbability < BLINK_THRESHOLD
        ) {
          // Blink right eye detected
          setBlinkStatus((prev) => ({ ...prev, rightEye: true }));
          setStep(3); // Move to face detected success step
        }
      }
    } else {
      setFaceDetectedInCircle(false);
    }
  });

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      const faces = detectFaces(frame);
      handleDetectedFaces(faces);
    },
    [handleDetectedFaces]
  );

  return (
    <View style={{ flex: 1 }}>
      {device ? (
        <>
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            frameProcessor={frameProcessor}
          />
          {/* Overlay */}
          <View pointerEvents='none' style={StyleSheet.absoluteFill}>
            <View style={styles.overlayContainer}>
              <View style={styles.maskTop} />
              <View style={styles.middleRow}>
                <View style={styles.maskSide} />
                <View style={styles.circle} />
                <View style={styles.maskSide} />
              </View>
              <View style={styles.maskBottom} />
            </View>

            {/* Prompt Messages */}
            {!faceDetectedInCircle && (
              <Text style={styles.promptText}>
                Please position your face inside the circle
              </Text>
            )}

            {faceDetectedInCircle && step === 1 && (
              <Text style={styles.promptText}>Please blink your left eye</Text>
            )}

            {faceDetectedInCircle && step === 2 && !blinkStatus.leftEye && (
              <Text style={styles.promptText}>
                Left eye blink detected. Now, blink your right eye
              </Text>
            )}

            {faceDetectedInCircle &&
              step === 3 &&
              blinkStatus.leftEye &&
              !blinkStatus.rightEye && (
                <Text style={styles.promptText}>
                  Right eye blink detected. Face detected successfully!
                </Text>
              )}
          </View>
        </>
      ) : (
        <Text>No Device</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    borderRadius: 20,
  },
  maskTop: {
    flex: 1,
    backgroundColor: "white",
  },
  middleRow: {
    height: CIRCLE_RADIUS * 2,
    flexDirection: "row",
  },
  maskSide: {
    flex: 1,
    backgroundColor: "white",
  },
  circle: {
    width: CIRCLE_RADIUS * 2,
    height: CIRCLE_RADIUS * 2,
    borderRadius: CIRCLE_RADIUS,
    borderWidth: 3,
    borderColor: "green",
    backgroundColor: "transparent",
  },
  maskBottom: {
    flex: 1,
    backgroundColor: "white",
  },
  promptText: {
    position: "absolute",
    bottom: 80,
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    color: "white",
    fontSize: 18,
    padding: 10,
    borderRadius: 10,
  },
});
