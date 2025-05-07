import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  Camera,
  useCameraDevice,
  useFrameProcessor,
  runAsync,
} from "react-native-vision-camera";
import {
  Face,
  useFaceDetector,
  FaceDetectionOptions,
} from "react-native-vision-camera-face-detector";
import { Worklets } from "react-native-worklets-core";

export default function App() {
  const faceDetectionOptions = useRef<FaceDetectionOptions>({
    performanceMode: "fast", // or "accurate"
    landmarkMode: "none", // or "all"
    classificationMode: "none", // or "all"
    contourMode: "none", // or "all"
  }).current;

  const device = useCameraDevice("front");
  const { detectFaces } = useFaceDetector(faceDetectionOptions);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      console.log({ status });
    })();
  }, [device]);

  // 2. Frame processor for real-time face detection
  const handleDetectedFaces = Worklets.createRunOnJS((faces: Face[]) => {
    console.log("faces detected", faces);
  });

  // 3. Format for optimal performance
  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      return runAsync(frame, () => {
        "worklet";
        const faces = detectFaces(frame);
        handleDetectedFaces(faces);
      });
    },
    [handleDetectedFaces]
  );

  return (
    <View style={{ flex: 1 }}>
      {!!device ? (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          frameProcessor={frameProcessor}
          fps={5} // Process 5 frames per second
        />
      ) : (
        <Text>No Device</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  faceBox: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "red",
    backgroundColor: "transparent",
  },
});
