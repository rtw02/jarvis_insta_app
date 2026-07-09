export interface DescriptorEntry {
  descriptor: Float32Array;
  postIndex: number;
}

export interface FaceCluster {
  id: number;
  descriptors: Float32Array[];
  centroid: Float32Array;
  postIndices: number[]; // may have duplicates if multiple faces from same post
}

function euclidean(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

function computeCentroid(descriptors: Float32Array[]): Float32Array {
  const n = descriptors.length;
  const centroid = new Float32Array(128);
  for (const d of descriptors) {
    for (let i = 0; i < 128; i++) centroid[i] += d[i];
  }
  for (let i = 0; i < 128; i++) centroid[i] /= n;
  return centroid;
}

export function clusterFaces(
  entries: DescriptorEntry[],
  threshold = 0.6
): FaceCluster[] {
  const clusters: FaceCluster[] = [];

  for (const entry of entries) {
    let bestCluster: FaceCluster | null = null;
    let bestDist = Infinity;

    for (const cluster of clusters) {
      const dist = euclidean(entry.descriptor, cluster.centroid);
      if (dist < threshold && dist < bestDist) {
        bestDist = dist;
        bestCluster = cluster;
      }
    }

    if (bestCluster) {
      bestCluster.descriptors.push(entry.descriptor);
      bestCluster.postIndices.push(entry.postIndex);
      bestCluster.centroid = computeCentroid(bestCluster.descriptors);
    } else {
      clusters.push({
        id: clusters.length,
        descriptors: [entry.descriptor],
        centroid: new Float32Array(entry.descriptor),
        postIndices: [entry.postIndex],
      });
    }
  }

  return clusters;
}

export function findMainSubject(clusters: FaceCluster[]): FaceCluster | null {
  if (clusters.length === 0) return null;
  // Count unique posts per cluster (not raw appearances, which can double-count group shots)
  return clusters.reduce((best, c) => {
    const uniquePosts = new Set(c.postIndices).size;
    const bestUnique = new Set(best.postIndices).size;
    return uniquePosts > bestUnique ? c : best;
  });
}

export function getMainSubjectPostIndices(cluster: FaceCluster): Set<number> {
  return new Set(cluster.postIndices);
}
