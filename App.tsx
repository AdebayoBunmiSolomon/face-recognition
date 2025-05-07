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

type stepType = "DETECT_FACE" | "BLINK_BOTH_EYES" | "SMILE" | "SUCCESS";

export default function App() {
  const [faceDetectedInCircle, setFaceDetectedInCircle] =
    useState<boolean>(false);
  const [step, setStep] = useState<stepType>("DETECT_FACE");
  const lastActionTimeRef = useRef<number>(0); // For debouncing
  const prevBothEyesClosedRef = useRef<boolean>(false); // Track if both eyes blinked
  const prevUserSmileRef = useRef<boolean>(false); // Track if mouth was open

  const faceDetectionOptions = useRef<FaceDetectionOptions>({
    performanceMode: "fast",
    landmarkMode: "none",
    classificationMode: "all", // For eye open and smiling probabilities
    contourMode: "none",
    trackingEnabled: false,
  }).current;

  const device = useCameraDevice("front");
  const { detectFaces } = useFaceDetector(faceDetectionOptions);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      console.log({ status });
    })();
  }, []);

  const handleDetectedFaces = Worklets.createRunOnJS((faces: Face[]) => {
    const now = Date.now();

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

      if (!isInsideCircle) {
        // Face not in circle, reset
        setStep("DETECT_FACE");
        prevBothEyesClosedRef.current = false;
        prevUserSmileRef.current = false;
        return;
      }

      // Face is in circle, process steps
      const leftEyeOpenProbability = face.leftEyeOpenProbability ?? 1.0;
      const rightEyeOpenProbability = face.rightEyeOpenProbability ?? 1.0;
      const smilingProbability = face.smilingProbability ?? 0.0;

      // Thresholds
      const CLOSED_THRESHOLD = 0.3; // Eyes closed if < 0.3
      const SMILE_THRESHOLD = 0.7; // Mouth open if > 0.7
      const DEBOUNCE_MS = 100; // Debounce period

      if (step === "DETECT_FACE") {
        // Face detected, move to blink step
        setStep("BLINK_BOTH_EYES");
      } else if (step === "BLINK_BOTH_EYES" && !prevBothEyesClosedRef.current) {
        // Detect both eyes blink
        if (
          leftEyeOpenProbability < CLOSED_THRESHOLD &&
          rightEyeOpenProbability < CLOSED_THRESHOLD &&
          now - lastActionTimeRef.current > DEBOUNCE_MS
        ) {
          prevBothEyesClosedRef.current = true;
          setStep("SMILE");
          lastActionTimeRef.current = now;
        }
      } else if (step === "SMILE" && !prevUserSmileRef.current) {
        // Detect mouth open
        if (
          smilingProbability > SMILE_THRESHOLD &&
          now - lastActionTimeRef.current > DEBOUNCE_MS
        ) {
          prevUserSmileRef.current = true;
          setStep("SUCCESS");
          lastActionTimeRef.current = now;
        }
      }
    } else {
      // No face detected, reset
      setFaceDetectedInCircle(false);
      setStep("DETECT_FACE");
      prevBothEyesClosedRef.current = false;
      prevUserSmileRef.current = false;
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

  // Prompt messages
  const getPromptMessage = () => {
    if (!faceDetectedInCircle) {
      return "Please position your face inside the circle";
    }
    switch (step) {
      case "DETECT_FACE":
        return "Please position your face inside the circle";
      case "BLINK_BOTH_EYES":
        return "Please blink both eyes";
      case "SMILE":
        return "Please smile";
      case "SUCCESS":
        return "Face detected successfully!";
      default:
        return "";
    }
  };

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
                <View
                  style={[
                    styles.circle,
                    { borderColor: faceDetectedInCircle ? "green" : "white" },
                  ]}
                />
                <View style={styles.maskSide} />
              </View>
              <View style={styles.maskBottom} />
            </View>

            {/* Prompt Message */}
            <Text style={styles.promptText}>{getPromptMessage()}</Text>
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
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
  middleRow: {
    height: CIRCLE_RADIUS * 2,
    flexDirection: "row",
  },
  maskSide: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
  circle: {
    width: CIRCLE_RADIUS * 2,
    height: CIRCLE_RADIUS * 2,
    borderRadius: CIRCLE_RADIUS,
    borderWidth: 3,
    backgroundColor: "transparent",
  },
  maskBottom: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
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
