import { Ionicons } from '@expo/vector-icons';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ScreenScroll } from '@/components/screen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch, apiTry } from '@/lib/api';
import { Haptics } from '@/lib/haptics';

interface Zone {
  id: string;
  name: string;
  zone_type: string;
  subject_name: string;
}

interface StagePrediction {
  id: number;
  predicted_stage: string;
  confidence: number;
  probabilities: Record<string, number>;
  nailed_it: boolean | null;
  created_at: string;
  image_url?: string;
}

const STAGE_ORDER = ['seedling', 'vegetative', 'fruiting'];
const INTERVAL_OPTIONS = [5, 10, 30, 60];

export default function VisionScreen() {
  const t = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('back');

  // Zones state
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('GH-01');

  // Auto-scheduler state
  const [isAutoActive, setIsAutoActive] = useState<boolean>(false);
  const [intervalSec, setIntervalSec] = useState<number>(10);
  const [countdown, setCountdown] = useState<number>(10);
  const [framesCaptured, setFramesCaptured] = useState<number>(0);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  // Prediction and validation state
  const [latestPrediction, setLatestPrediction] = useState<StagePrediction | null>(null);
  const [validationLoading, setValidationLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // 1. Declare loadZones before useEffect
  const loadZones = useCallback(async () => {
    const res = await apiTry<{ zones: Zone[] }>('/api/zones');
    if (res?.zones && res.zones.length > 0) {
      setZones(res.zones);
      const gh = res.zones.find((z) => z.zone_type === 'greenhouse');
      if (gh) {
        setSelectedZoneId(gh.id);
      } else {
        setSelectedZoneId(res.zones[0].id);
      }
    }
  }, []);

  // 2. Declare loadLatestPrediction before useEffect
  const loadLatestPrediction = useCallback(async (zoneId: string) => {
    const res = await apiTry<{ prediction: any }>(`/api/zones/${zoneId}/predictions/latest`);
    if (res?.prediction) {
      setLatestPrediction({
        id: res.prediction.id,
        predicted_stage: res.prediction.predicted_stage,
        confidence: parseFloat(res.prediction.confidence),
        probabilities: res.prediction.raw_probabilities || {},
        nailed_it: res.prediction.nailed_it,
        created_at: res.prediction.created_at,
        image_url: res.prediction.image_url,
      });
    }
  }, []);

  // 3. Declare triggerCapture before useEffect
  const triggerCapture = useCallback(async () => {
    if (!cameraRef.current || isAnalyzing) return;

    try {
      setIsAnalyzing(true);
      Haptics.light();

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });

      if (!photo?.uri) {
        setIsAnalyzing(false);
        return;
      }

      const formData = new FormData();
      if (Platform.OS === 'web') {
        const fetchRes = await fetch(photo.uri);
        const blob = await fetchRes.blob();
        formData.append('file', blob, `capture_${Date.now()}.jpg`);
      } else {
        formData.append('file', {
          uri: photo.uri,
          name: `capture_${Date.now()}.jpg`,
          type: 'image/jpeg',
        } as any);
      }

      const res = await apiFetch<any>(`/api/zones/${selectedZoneId}/capture?source=expo_camera_auto`, {
        method: 'POST',
        body: formData,
      });

      if (res?.success && res?.prediction) {
        setLatestPrediction({
          id: res.prediction.id,
          predicted_stage: res.prediction.predicted_stage,
          confidence: parseFloat(res.prediction.confidence),
          probabilities: res.prediction.probabilities || {},
          nailed_it: null,
          created_at: res.prediction.created_at,
          image_url: res.image_url,
        });
        setFramesCaptured((c) => c + 1);
        setStatusMessage(`Prediction updated: ${res.prediction.predicted_stage}`);
        Haptics.success();
      }
    } catch (err: any) {
      console.error('[Vision Capture Error]', err);
      setStatusMessage(`Capture failed: ${err.message || 'Network error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, selectedZoneId]);

  // Effects declared AFTER functions
  useEffect(() => {
    void (async () => {
      await loadZones();
    })();
  }, [loadZones]);

  useEffect(() => {
    if (selectedZoneId) {
      void (async () => {
        await loadLatestPrediction(selectedZoneId);
      })();
    }
  }, [selectedZoneId, loadLatestPrediction]);

  // Auto-scheduler interval effect
  useEffect(() => {
    if (!isAutoActive) {
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          triggerCapture();
          return intervalSec;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAutoActive, intervalSec, triggerCapture]);

  const handleValidate = async (nailedIt: boolean) => {
    if (!latestPrediction) return;
    try {
      setValidationLoading(true);
      Haptics.medium();

      const res = await apiFetch<any>(
        `/api/zones/vision/predictions/${latestPrediction.id}/validate?nailed_it=${nailedIt}`,
        { method: 'POST' }
      );

      if (res?.success) {
        setLatestPrediction((prev) => (prev ? { ...prev, nailed_it: nailedIt } : null));
        setStatusMessage(
          nailedIt
            ? 'Ground Truth Saved: Confirmed Nailed It'
            : 'Ground Truth Saved: Marked Missed It'
        );
        Haptics.success();
      }
    } catch (err: any) {
      console.error('[Validation Error]', err);
    } finally {
      setValidationLoading(false);
    }
  };

  const toggleFacing = () => {
    Haptics.light();
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  const selectedZone = zones.find((z) => z.id === selectedZoneId);

  // If camera permission not granted
  if (!permission) {
    return (
      <ScreenScroll>
        <Card style={{ margin: t.spacing.lg }}>
          <CardHeader>
            <CardTitle>Camera Access</CardTitle>
            <CardDescription>Requesting camera permission...</CardDescription>
          </CardHeader>
        </Card>
      </ScreenScroll>
    );
  }

  if (!permission.granted) {
    return (
      <ScreenScroll>
        <Card style={{ margin: t.spacing.lg, padding: t.spacing.md }}>
          <CardHeader>
            <Ionicons name="camera-outline" size={48} color={t.colors.primary} />
            <CardTitle style={{ marginTop: t.spacing.sm }}>Camera Permission Required</CardTitle>
            <CardDescription>
              ZoneMatrix uses your device camera to inspect farm zones and predict growth stages in real time.
            </CardDescription>
          </CardHeader>
          <CardContent style={{ gap: t.spacing.md }}>
            <Button onPress={() => { requestPermission(); }}>
              Grant Camera Permission
            </Button>
          </CardContent>
        </Card>
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll>
      <View style={{ gap: t.spacing.lg, paddingBottom: t.spacing.xxl }}>
        {/* Zone Selector */}
        <Card>
          <CardHeader style={{ paddingBottom: t.spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <CardTitle>Active Inspection Zone</CardTitle>
                <CardDescription>
                  {selectedZone
                    ? `${selectedZone.name} • ${selectedZone.subject_name}`
                    : 'Select a zone to inspect'}
                </CardDescription>
              </View>
              <Badge variant="outline">
                {selectedZone?.zone_type === 'greenhouse'
                  ? '🌿 Greenhouse'
                  : selectedZone?.zone_type === 'pond'
                    ? '🐟 Pond'
                    : '🐄 Kraal / Pen'}
              </Badge>
            </View>
          </CardHeader>
          <CardContent>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {zones.map((z) => {
                const active = z.id === selectedZoneId;
                return (
                  <TouchableOpacity
                    key={z.id}
                    onPress={() => {
                      Haptics.light();
                      setSelectedZoneId(z.id);
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: active ? t.colors.primary : t.colors.border,
                      backgroundColor: active ? t.colors.accent : t.colors.card,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? t.colors.primary : t.colors.foreground,
                        fontWeight: active ? 'bold' : 'normal',
                        fontSize: 13,
                      }}
                    >
                      {z.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </CardContent>
        </Card>

        {/* Live Camera Viewfinder */}
        <Card style={{ overflow: 'hidden' }}>
          <View style={{ position: 'relative', width: '100%', height: 320, backgroundColor: '#000' }}>
            <CameraView
              ref={cameraRef}
              facing={facing}
              style={StyleSheet.absoluteFill}
            />

            {/* Overlays on Camera */}
            <View
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                right: 12,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 16,
                  gap: 6,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: isAutoActive ? '#ef4444' : '#10b981',
                  }}
                />
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                  {isAutoActive ? `AUTO-INTERVAL: ${countdown}s` : 'MANUAL MODE'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={toggleFacing}
                style={{
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="camera-reverse-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Bottom Camera Action Bar */}
            <View
              style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                right: 12,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
                Frames Sent: {framesCaptured}
              </Text>

              <TouchableOpacity
                onPress={triggerCapture}
                disabled={isAnalyzing}
                style={{
                  backgroundColor: t.colors.primary,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {isAnalyzing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="camera" size={16} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Snap & Predict</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Card>

        {/* Auto-Scheduler Interval Controls */}
        <Card>
          <CardHeader>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <CardTitle>Auto-Scheduler Interval</CardTitle>
              <Pressable
                onPress={() => {
                  Haptics.light();
                  const nextState = !isAutoActive;
                  setIsAutoActive(nextState);
                  if (nextState) {
                    setCountdown(intervalSec);
                  }
                }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 16,
                  backgroundColor: isAutoActive ? '#10b981' : t.colors.muted,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>
                  {isAutoActive ? 'AUTO-CAPTURE ON' : 'PAUSED'}
                </Text>
              </Pressable>
            </View>
            <CardDescription>
              Automatically captures a frame from the stream and runs AI growth stage inference.
            </CardDescription>
          </CardHeader>
          <CardContent style={{ gap: t.spacing.sm }}>
            <Text style={{ fontSize: 12, color: t.colors.mutedForeground }}>Select Test Interval:</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {INTERVAL_OPTIONS.map((sec) => (
                <TouchableOpacity
                  key={sec}
                  onPress={() => {
                    Haptics.light();
                    setIntervalSec(sec);
                    setCountdown(sec);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 8,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: intervalSec === sec ? t.colors.primary : t.colors.border,
                    backgroundColor: intervalSec === sec ? t.colors.accent : t.colors.card,
                  }}
                >
                  <Text
                    style={{
                      fontWeight: intervalSec === sec ? 'bold' : 'normal',
                      color: intervalSec === sec ? t.colors.primary : t.colors.foreground,
                    }}
                  >
                    {sec}s
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </CardContent>
        </Card>

        {/* Real-Time AI Prediction HUD */}
        <Card>
          <CardHeader>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <CardTitle>AI Growth Stage Inference</CardTitle>
              {latestPrediction && (
                <Badge variant="default">
                  {`${latestPrediction.confidence.toFixed(1)}% Conf`}
                </Badge>
              )}
            </View>
            <CardDescription>
              Model: growth_stage_model.h5 (Teachable Machine / Keras)
            </CardDescription>
          </CardHeader>
          <CardContent style={{ gap: t.spacing.md }}>
            {latestPrediction ? (
              <>
                {/* 3-Step Lifecycle Progression Indicator */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
                  {STAGE_ORDER.map((stage, idx) => {
                    const isCurrent = latestPrediction.predicted_stage.toLowerCase() === stage;
                    return (
                      <View key={stage} style={{ flex: 1, alignItems: 'center' }}>
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: isCurrent ? '#10b981' : t.colors.muted,
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderWidth: isCurrent ? 2 : 1,
                            borderColor: isCurrent ? '#059669' : t.colors.border,
                          }}
                        >
                          <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                            {idx + 1}
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 11,
                            marginTop: 4,
                            textTransform: 'capitalize',
                            fontWeight: isCurrent ? 'bold' : 'normal',
                            color: isCurrent ? t.colors.primary : t.colors.mutedForeground,
                          }}
                        >
                          {stage}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Softmax Probabilities Breakdown */}
                <View style={{ backgroundColor: t.colors.accent, padding: 12, borderRadius: 8, gap: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: t.colors.foreground }}>
                    Predicted Stage: {latestPrediction.predicted_stage.toUpperCase()}
                  </Text>
                  {Object.entries(latestPrediction.probabilities).map(([label, prob]) => (
                    <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 11, color: t.colors.mutedForeground, textTransform: 'capitalize' }}>
                        {label}
                      </Text>
                      <Text style={{ fontSize: 11, color: t.colors.foreground, fontWeight: '500' }}>
                        {(prob * 100).toFixed(1)}%
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Human-in-the-Loop Validation ("Nailed It or Not") */}
                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: t.colors.border,
                    paddingTop: t.spacing.md,
                    gap: 8,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: t.colors.foreground }}>
                    Human Verification (Active Learning):
                  </Text>

                  {latestPrediction.nailed_it !== null ? (
                    <View
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        backgroundColor: latestPrediction.nailed_it ? '#ecfdf5' : '#fef2f2',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <Ionicons
                        name={latestPrediction.nailed_it ? 'checkmark-circle' : 'close-circle'}
                        size={20}
                        color={latestPrediction.nailed_it ? '#10b981' : '#ef4444'}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          color: latestPrediction.nailed_it ? '#065f46' : '#991b1b',
                          fontWeight: 'bold',
                        }}
                      >
                        Status:{' '}
                        {latestPrediction.nailed_it ? 'Confirmed Nailed It' : 'Marked Missed It'} (Saved for Retraining)
                      </Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                      <TouchableOpacity
                        onPress={() => handleValidate(true)}
                        disabled={validationLoading}
                        style={{
                          flex: 1,
                          backgroundColor: '#10b981',
                          paddingVertical: 10,
                          borderRadius: 8,
                          flexDirection: 'row',
                          justifyContent: 'center',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Ionicons name="thumbs-up" size={16} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Nailed It</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleValidate(false)}
                        disabled={validationLoading}
                        style={{
                          flex: 1,
                          backgroundColor: '#ef4444',
                          paddingVertical: 10,
                          borderRadius: 8,
                          flexDirection: 'row',
                          justifyContent: 'center',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Ionicons name="thumbs-down" size={16} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Missed It</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </>
            ) : (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <Text style={{ color: t.colors.mutedForeground, fontSize: 13 }}>
                  No predictions yet. Tap {'"Snap & Predict"'} or enable Auto-Capture above.
                </Text>
              </View>
            )}

            {statusMessage && (
              <Text style={{ fontSize: 11, color: t.colors.mutedForeground, textAlign: 'center', marginTop: 4 }}>
                {statusMessage}
              </Text>
            )}
          </CardContent>
        </Card>
      </View>
    </ScreenScroll>
  );
}
