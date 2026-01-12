import * as faceapi from 'face-api.js';

export interface FaceRecord {
    image: string;
    vectors: number[][];
}

export class FaceMatcher {
    private static instance: FaceMatcher;
    private modelsLoaded = false;
    private index: FaceRecord[] = [];

    private constructor() { }

    public static getInstance(): FaceMatcher {
        if (!FaceMatcher.instance) {
            FaceMatcher.instance = new FaceMatcher();
        }
        return FaceMatcher.instance;
    }

    public async loadModels() {
        if (this.modelsLoaded) return;
        try {
            const MODEL_URL = '/models';
            await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
            await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
            await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
            this.modelsLoaded = true;
            console.log("Models loaded");
        } catch (e) {
            console.error("Failed to load models", e);
        }
    }

    public async loadIndex(indexData: FaceRecord[]) {
        this.index = indexData;
        console.log(`Index loaded with ${this.index.length} images`);
    }

    public async findMatches(selfieUrl: string): Promise<string[]> {
        if (!this.modelsLoaded) await this.loadModels();

        const img = await faceapi.fetchImage(selfieUrl);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

        if (!detection) {
            console.warn("No face detected in selfie");
            return [];
        }

        const selfieVector = detection.descriptor;
        const matches: string[] = [];
        const threshold = 0.55;

        for (const entry of this.index) {
            for (const vector of entry.vectors) {
                const dist = faceapi.euclideanDistance(selfieVector, vector);
                if (dist < threshold) {
                    matches.push(entry.image);
                    break;
                }
            }
        }

        return matches;
    }
}
