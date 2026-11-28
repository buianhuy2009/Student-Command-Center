import React, { useState } from 'react';
import { X, Sparkles, CheckCircle2, Zap, ArrowRight } from 'lucide-react';
import { useT, type TranslationKey } from '../services/i18n';

type Batch3Key = TranslationKey;

export const CURRENT_VERSION = '3.6.9';

interface VersionRelease {
  version: string;
  isoDate: string;
  titleKey: Batch3Key;
  badgeKey?: Batch3Key;
  highlightKeys: readonly Batch3Key[];
  detailKeys: readonly Batch3Key[];
}

const RELEASES: VersionRelease[] = [
  {
    version: '3.6.9',
    isoDate: '2026-11-28',
    titleKey: 'changelog_r_3_6_9_t',
    badgeKey: 'changelog_latest_badge',
    highlightKeys: ['changelog_r_3_6_9_h1', 'changelog_r_3_6_9_h2'],
    detailKeys: ['changelog_r_3_6_9_d1', 'changelog_r_3_6_9_d2'],
  },
  {
    version: '3.6.8',
    isoDate: '2026-11-28',
    titleKey: 'changelog_r_3_6_8_t',
    highlightKeys: ['changelog_r_3_6_8_h1'],
    detailKeys: ['changelog_r_3_6_8_d1'],
  },
  {
    version: '3.6.7',
    isoDate: '2026-11-28',
    titleKey: 'changelog_r_3_6_7_t',
    highlightKeys: ['changelog_r_3_6_7_h1', 'changelog_r_3_6_7_h2', 'changelog_r_3_6_7_h3'],
    detailKeys: ['changelog_r_3_6_7_d1', 'changelog_r_3_6_7_d2', 'changelog_r_3_6_7_d3', 'changelog_r_3_6_7_d4'],
  },
  {
    version: '3.6.6',
    isoDate: '2026-11-28',
    titleKey: 'changelog_r_3_6_6_t',
    highlightKeys: ['changelog_r_3_6_6_h1', 'changelog_r_3_6_6_h2'],
    detailKeys: ['changelog_r_3_6_6_d1', 'changelog_r_3_6_6_d2'],
  },
  {
    version: '3.6.5',
    isoDate: '2026-11-28',
    titleKey: 'changelog_r_3_6_5_t',
    highlightKeys: ['changelog_r_3_6_5_h1'],
    detailKeys: ['changelog_r_3_6_5_d1'],
  },
  {
    version: '3.6.4',
    isoDate: '2026-11-28',
    titleKey: 'changelog_r_3_6_4_t',
    highlightKeys: ['changelog_r_3_6_4_h1'],
    detailKeys: ['changelog_r_3_6_4_d1'],
  },
  {
    version: '3.6.3',
    isoDate: '2026-11-28',
    titleKey: 'changelog_r_3_6_3_t',
    highlightKeys: ['changelog_r_3_6_3_h1', 'changelog_r_3_6_3_h2'],
    detailKeys: ['changelog_r_3_6_3_d1', 'changelog_r_3_6_3_d2'],
  },
  {
    version: '3.6.2',
    isoDate: '2026-11-28',
    titleKey: 'changelog_r_3_6_2_t',
    highlightKeys: ['changelog_r_3_6_2_h1', 'changelog_r_3_6_2_h2'],
    detailKeys: ['changelog_r_3_6_2_d1', 'changelog_r_3_6_2_d2'],
  },
  {
    version: '3.6.1',
    isoDate: '2026-11-28',
    titleKey: 'changelog_r_3_6_1_t',
    highlightKeys: ['changelog_r_3_6_1_h1', 'changelog_r_3_6_1_h2', 'changelog_r_3_6_1_h3'],
    detailKeys: ['changelog_r_3_6_1_d1', 'changelog_r_3_6_1_d2', 'changelog_r_3_6_1_d3'],
  },
  {
    version: '3.6.0',
    isoDate: '2026-11-28',
    titleKey: 'changelog_r_3_6_0_t',
    highlightKeys: [
      'changelog_r_3_6_0_h1',
      'changelog_r_3_6_0_h2',
      'changelog_r_3_6_0_h3',
    ],
    detailKeys: [
      'changelog_r_3_6_0_d1',
      'changelog_r_3_6_0_d2',
      'changelog_r_3_6_0_d3',
    ],
  },
  {
    version: '3.5.4',
    isoDate: '2026-11-28',
    titleKey: 'changelog_r_3_5_4_t',
    highlightKeys: ['changelog_r_3_5_4_h1'],
    detailKeys: ['changelog_r_3_5_4_d1'],
  },
  {
    version: '3.5.3',
    isoDate: '2026-11-28',
    titleKey: 'changelog_r_3_5_3_t',
    highlightKeys: ['changelog_r_3_5_3_h1'],
    detailKeys: ['changelog_r_3_5_3_d1'],
  },
  {
    version: '3.5.2',
    isoDate: '2026-11-26',
    titleKey: 'changelog_r_3_5_2_t',
    highlightKeys: [
      'changelog_r_3_5_2_h1',
      'changelog_r_3_5_2_h2',
    ],
    detailKeys: [
      'changelog_r_3_5_2_d1',
      'changelog_r_3_5_2_d2',
    ],
  },
  {
    version: '3.5.1',
    isoDate: '2026-11-26',
    titleKey: 'changelog_r_3_5_1_t',
    highlightKeys: [
      'changelog_r_3_5_1_h1',
      'changelog_r_3_5_1_h2',
      'changelog_r_3_5_1_h3',
    ],
    detailKeys: [
      'changelog_r_3_5_1_d1',
      'changelog_r_3_5_1_d2',
      'changelog_r_3_5_1_d3',
    ],
  },
  {
    version: '3.5.0',
    isoDate: '2026-11-26',
    titleKey: 'changelog_r_3_5_0_t',
    highlightKeys: [
      'changelog_r_3_5_0_h1',
      'changelog_r_3_5_0_h2',
      'changelog_r_3_5_0_h3',
    ],
    detailKeys: [
      'changelog_r_3_5_0_d1',
      'changelog_r_3_5_0_d2',
      'changelog_r_3_5_0_d3',
    ],
  },
  {
    version: '3.4.0',
    isoDate: '2026-11-26',
    titleKey: 'changelog_r_3_4_0_t',
    highlightKeys: [
      'changelog_r_3_4_0_h1',
      'changelog_r_3_4_0_h2',
      'changelog_r_3_4_0_h3',
    ],
    detailKeys: [
      'changelog_r_3_4_0_d1',
      'changelog_r_3_4_0_d2',
      'changelog_r_3_4_0_d3',
    ],
  },
  {
    version: '3.3.1',
    isoDate: '2026-11-26',
    titleKey: 'changelog_r_3_3_1_t',
    highlightKeys: [
      'changelog_r_3_3_1_h1',
      'changelog_r_3_3_1_h2',
      'changelog_r_3_3_1_h3',
    ],
    detailKeys: [
      'changelog_r_3_3_1_d1',
      'changelog_r_3_3_1_d2',
      'changelog_r_3_3_1_d3',
    ],
  },
  {
    version: '3.3.0',
    isoDate: '2026-11-26',
    titleKey: 'changelog_r_3_3_0_t',
    highlightKeys: [
      'changelog_r_3_3_0_h1',
      'changelog_r_3_3_0_h2',
      'changelog_r_3_3_0_h3',
    ],
    detailKeys: [
      'changelog_r_3_3_0_d1',
      'changelog_r_3_3_0_d2',
      'changelog_r_3_3_0_d3',
    ],
  },
  {
    version: '3.2.1',
    isoDate: '2026-11-24',
    titleKey: 'changelog_r_3_2_1_t',
    highlightKeys: [
      'changelog_r_3_2_1_h1',
      'changelog_r_3_2_1_h2',
      'changelog_r_3_2_1_h3',
    ],
    detailKeys: [
      'changelog_r_3_2_1_d1',
      'changelog_r_3_2_1_d2',
      'changelog_r_3_2_1_d3',
    ],
  },
  {
    version: '3.2.0',
    isoDate: '2026-11-24',
    titleKey: 'changelog_r_3_2_0_t',
    highlightKeys: [
      'changelog_r_3_2_0_h1',
      'changelog_r_3_2_0_h2',
      'changelog_r_3_2_0_h3',
      'changelog_r_3_2_0_h4',
    ],
    detailKeys: [
      'changelog_r_3_2_0_d1',
      'changelog_r_3_2_0_d2',
      'changelog_r_3_2_0_d3',
      'changelog_r_3_2_0_d4',
    ],
  },
  {
    version: '3.1.0',
    isoDate: '2026-11-24',
    titleKey: 'changelog_r_3_1_0_t',
    highlightKeys: [
      'changelog_r_3_1_0_h1',
      'changelog_r_3_1_0_h2',
      'changelog_r_3_1_0_h3',
    ],
    detailKeys: [
      'changelog_r_3_1_0_d1',
      'changelog_r_3_1_0_d2',
      'changelog_r_3_1_0_d3',
    ],
  },
  {
    version: '3.0.1',
    isoDate: '2026-11-24',
    titleKey: 'changelog_r_2_24_1_t',
    highlightKeys: [
      'changelog_r_2_24_1_h1',
      'changelog_r_2_24_1_h2',
      'changelog_r_2_24_1_h3',
    ],
    detailKeys: [
      'changelog_r_2_24_1_d1',
      'changelog_r_2_24_1_d2',
      'changelog_r_2_24_1_d3',
    ],
  },
  {
    version: '3.0.0',
    isoDate: '2026-11-24',
    titleKey: 'changelog_r_2_24_0_t',
    highlightKeys: [
      'changelog_r_2_24_0_h1',
      'changelog_r_2_24_0_h2',
      'changelog_r_2_24_0_h3',
    ],
    detailKeys: [
      'changelog_r_2_24_0_d1',
      'changelog_r_2_24_0_d2',
      'changelog_r_2_24_0_d3',
    ],
  },
  {
    version: '2.23.2',
    isoDate: '2026-11-23',
    titleKey: 'changelog_r_2_23_2_t',
    highlightKeys: [
      'changelog_r_2_23_2_h1',
      'changelog_r_2_23_2_h2',
      'changelog_r_2_23_2_h3',
    ],
    detailKeys: [
      'changelog_r_2_23_2_d1',
      'changelog_r_2_23_2_d2',
      'changelog_r_2_23_2_d3',
    ],
  },
  {
    version: '2.23.1',
    isoDate: '2026-11-23',
    titleKey: 'changelog_r_2_23_1_t',
    highlightKeys: [
      'changelog_r_2_23_1_h1',
      'changelog_r_2_23_1_h2',
      'changelog_r_2_23_1_h3',
    ],
    detailKeys: [
      'changelog_r_2_23_1_d1',
      'changelog_r_2_23_1_d2',
      'changelog_r_2_23_1_d3',
    ],
  },
  {
    version: '2.23.0',
    isoDate: '2026-11-23',
    titleKey: 'changelog_r_2_23_0_t',
    highlightKeys: [
      'changelog_r_2_23_0_h1',
      'changelog_r_2_23_0_h2',
      'changelog_r_2_23_0_h3',
    ],
    detailKeys: [
      'changelog_r_2_23_0_d1',
      'changelog_r_2_23_0_d2',
      'changelog_r_2_23_0_d3',
    ],
  },
  {
    version: '2.22.0',
    isoDate: '2026-11-22',
    titleKey: 'changelog_r_2_22_0_t',
    highlightKeys: [
      'changelog_r_2_22_0_h1',
      'changelog_r_2_22_0_h2',
      'changelog_r_2_22_0_h3',
    ],
    detailKeys: [
      'changelog_r_2_22_0_d1',
      'changelog_r_2_22_0_d2',
      'changelog_r_2_22_0_d3',
    ],
  },
  {
    version: '2.21.0',
    isoDate: '2026-11-22',
    titleKey: 'changelog_r_2_21_0_t',
    highlightKeys: [
      'changelog_r_2_21_0_h1',
      'changelog_r_2_21_0_h2',
      'changelog_r_2_21_0_h3',
    ],
    detailKeys: [
      'changelog_r_2_21_0_d1',
      'changelog_r_2_21_0_d2',
      'changelog_r_2_21_0_d3',
    ],
  },
  {
    version: '2.20.4',
    isoDate: '2026-11-15',
    titleKey: 'changelog_r_2_20_4_t',
    highlightKeys: [
      'changelog_r_2_20_4_h1',
      'changelog_r_2_20_4_h2',
      'changelog_r_2_20_4_h3',
    ],
    detailKeys: [
      'changelog_r_2_20_4_d1',
      'changelog_r_2_20_4_d2',
      'changelog_r_2_20_4_d3',
    ],
  },
  {
    version: '2.20.3',
    isoDate: '2026-11-15',
    titleKey: 'changelog_r_2_20_3_t',
    highlightKeys: [
      'changelog_r_2_20_3_h1',
      'changelog_r_2_20_3_h2',
      'changelog_r_2_20_3_h3',
    ],
    detailKeys: [
      'changelog_r_2_20_3_d1',
      'changelog_r_2_20_3_d2',
      'changelog_r_2_20_3_d3',
    ],
  },
  {
    version: '2.20.2',
    isoDate: '2026-11-15',
    titleKey: 'changelog_r_2_20_2_t',
    highlightKeys: [
      'changelog_r_2_20_2_h1',
      'changelog_r_2_20_2_h2',
      'changelog_r_2_20_2_h3',
    ],
    detailKeys: [
      'changelog_r_2_20_2_d1',
      'changelog_r_2_20_2_d2',
      'changelog_r_2_20_2_d3',
    ],
  },
  {
    version: '2.20.1',
    isoDate: '2026-11-15',
    titleKey: 'changelog_r_2_20_1_t',
    highlightKeys: [
      'changelog_r_2_20_1_h1',
      'changelog_r_2_20_1_h2',
      'changelog_r_2_20_1_h3',
    ],
    detailKeys: [
      'changelog_r_2_20_1_d1',
      'changelog_r_2_20_1_d2',
      'changelog_r_2_20_1_d3',
    ],
  },
  {
    version: '2.20.0',
    isoDate: '2026-11-15',
    titleKey: 'changelog_r_2_20_0_t',
    highlightKeys: [
      'changelog_r_2_20_0_h1',
      'changelog_r_2_20_0_h2',
      'changelog_r_2_20_0_h3',
      'changelog_r_2_20_0_h4',
    ],
    detailKeys: [
      'changelog_r_2_20_0_d1',
      'changelog_r_2_20_0_d2',
      'changelog_r_2_20_0_d3',
      'changelog_r_2_20_0_d4',
    ],
  },
  {
    version: '2.19.0',
    isoDate: '2026-11-14',
    titleKey: 'changelog_r_2_19_0_t',
    highlightKeys: [
      'changelog_r_2_19_0_h1',
      'changelog_r_2_19_0_h2',
      'changelog_r_2_19_0_h3',
      'changelog_r_2_19_0_h4',
    ],
    detailKeys: [
      'changelog_r_2_19_0_d1',
      'changelog_r_2_19_0_d2',
      'changelog_r_2_19_0_d3',
      'changelog_r_2_19_0_d4',
      'changelog_r_2_19_0_d5',
    ],
  },
  {
    version: '2.18.5',
    isoDate: '2026-10-17',
    titleKey: 'changelog_r_2_18_5_t',
    highlightKeys: ['changelog_r_2_18_5_h1', 'changelog_r_2_18_5_h2'],
    detailKeys: ['changelog_r_2_18_5_d1', 'changelog_r_2_18_5_d2'],
  },
  {
    version: '2.18.4',
    isoDate: '2026-10-17',
    titleKey: 'changelog_r_2_18_4_t',
    highlightKeys: ['changelog_r_2_18_4_h1', 'changelog_r_2_18_4_h2'],
    detailKeys: ['changelog_r_2_18_4_d1', 'changelog_r_2_18_4_d2', 'changelog_r_2_18_4_d3'],
  },
  {
    version: '2.18.3',
    isoDate: '2026-10-17',
    titleKey: 'changelog_r_2_18_3_t',
    highlightKeys: ['changelog_r_2_18_3_h1', 'changelog_r_2_18_3_h2'],
    detailKeys: ['changelog_r_2_18_3_d1', 'changelog_r_2_18_3_d2'],
  },
  {
    version: '2.18.2',
    isoDate: '2026-10-17',
    titleKey: 'changelog_r_2_18_2_t',
    highlightKeys: ['changelog_r_2_18_2_h1', 'changelog_r_2_18_2_h2'],
    detailKeys: ['changelog_r_2_18_2_d1', 'changelog_r_2_18_2_d2'],
  },
  {
    version: '2.18.1',
    isoDate: '2026-10-16',
    titleKey: 'changelog_r_2_18_1_t',
    highlightKeys: ['changelog_r_2_18_1_h1', 'changelog_r_2_18_1_h2'],
    detailKeys: ['changelog_r_2_18_1_d1', 'changelog_r_2_18_1_d2', 'changelog_r_2_18_1_d3'],
  },
  {
    version: '2.18.0',
    isoDate: '2026-10-16',
    titleKey: 'changelog_r_2_18_0_t',
    highlightKeys: ['changelog_r_2_18_0_h1', 'changelog_r_2_18_0_h2', 'changelog_r_2_18_0_h3', 'changelog_r_2_18_0_h4'],
    detailKeys: [
      'changelog_r_2_18_0_d1',
      'changelog_r_2_18_0_d2',
      'changelog_r_2_18_0_d3',
      'changelog_r_2_18_0_d4',
      'changelog_r_2_18_0_d5',
      'changelog_r_2_18_0_d6',
    ],
  },
  {
    version: '2.17.1',
    isoDate: '2026-10-16',
    titleKey: 'changelog_r_2_17_1_t',
    highlightKeys: ['changelog_r_2_17_1_h1'],
    detailKeys: ['changelog_r_2_17_1_d1'],
  },
  {
    version: '2.17.0',
    isoDate: '2026-10-16',
    titleKey: 'changelog_r_2_17_0_t',
    highlightKeys: ['changelog_r_2_17_0_h1', 'changelog_r_2_17_0_h2', 'changelog_r_2_17_0_h3', 'changelog_r_2_17_0_h4'],
    detailKeys: [
      'changelog_r_2_17_0_d1',
      'changelog_r_2_17_0_d2',
      'changelog_r_2_17_0_d3',
      'changelog_r_2_17_0_d4',
      'changelog_r_2_17_0_d5',
      'changelog_r_2_17_0_d6',
      'changelog_r_2_17_0_d7',
    ],
  },
  {
    version: '2.16.0',
    isoDate: '2026-09-20',
    titleKey: 'changelog_r_2_16_0_t',
    highlightKeys: ['changelog_r_2_16_0_h1', 'changelog_r_2_16_0_h2', 'changelog_r_2_16_0_h3', 'changelog_r_2_16_0_h4'],
    detailKeys: ['changelog_r_2_16_0_d1', 'changelog_r_2_16_0_d2', 'changelog_r_2_16_0_d3'],
  },
  {
    version: '2.15.0',
    isoDate: '2026-09-14',
    titleKey: 'changelog_r_2_15_0_t',
    highlightKeys: ['changelog_r_2_15_0_h1', 'changelog_r_2_15_0_h2', 'changelog_r_2_15_0_h3'],
    detailKeys: ['changelog_r_2_15_0_d1', 'changelog_r_2_15_0_d2', 'changelog_r_2_15_0_d3'],
  },
  {
    version: '2.14.0',
    isoDate: '2026-09-14',
    titleKey: 'changelog_r_2_14_0_t',
    highlightKeys: ['changelog_r_2_14_0_h1', 'changelog_r_2_14_0_h2'],
    detailKeys: ['changelog_r_2_14_0_d1', 'changelog_r_2_14_0_d2'],
  },
  {
    version: '2.13.0',
    isoDate: '2026-09-14',
    titleKey: 'changelog_r_2_13_0_t',
    highlightKeys: ['changelog_r_2_13_0_h1', 'changelog_r_2_13_0_h2', 'changelog_r_2_13_0_h3'],
    detailKeys: ['changelog_r_2_13_0_d1', 'changelog_r_2_13_0_d2', 'changelog_r_2_13_0_d3'],
  },
  {
    version: '2.12.0',
    isoDate: '2026-09-13',
    titleKey: 'changelog_r_2_12_0_t',
    highlightKeys: ['changelog_r_2_12_0_h1', 'changelog_r_2_12_0_h2'],
    detailKeys: ['changelog_r_2_12_0_d1', 'changelog_r_2_12_0_d2', 'changelog_r_2_12_0_d3'],
  },
  {
    version: '2.11.0',
    isoDate: '2026-09-13',
    titleKey: 'changelog_r_2_11_0_t',
    highlightKeys: ['changelog_r_2_11_0_h1', 'changelog_r_2_11_0_h2', 'changelog_r_2_11_0_h3'],
    detailKeys: [
      'changelog_r_2_11_0_d1',
      'changelog_r_2_11_0_d2',
      'changelog_r_2_11_0_d3',
      'changelog_r_2_11_0_d4',
      'changelog_r_2_11_0_d5',
      'changelog_r_2_11_0_d6',
      'changelog_r_2_11_0_d7',
      'changelog_r_2_11_0_d8',
      'changelog_r_2_11_0_d9',
      'changelog_r_2_11_0_d10',
      'changelog_r_2_11_0_d11',
      'changelog_r_2_11_0_d12',
      'changelog_r_2_11_0_d13',
      'changelog_r_2_11_0_d14',
      'changelog_r_2_11_0_d15',
    ],
  },
  {
    version: '2.10.0',
    isoDate: '2026-09-12',
    titleKey: 'changelog_r_2_10_0_t',
    highlightKeys: ['changelog_r_2_10_0_h1'],
    detailKeys: ['changelog_r_2_10_0_d1'],
  },
  {
    version: '2.9.8',
    isoDate: '2026-09-12',
    titleKey: 'changelog_r_2_9_8_t',
    highlightKeys: ['changelog_r_2_9_8_h1', 'changelog_r_2_9_8_h2'],
    detailKeys: ['changelog_r_2_9_8_d1', 'changelog_r_2_9_8_d2'],
  },
  {
    version: '2.8.4',
    isoDate: '2026-09-12',
    titleKey: 'changelog_r_2_8_4_t',
    highlightKeys: ['changelog_r_2_8_4_h1', 'changelog_r_2_8_4_h2'],
    detailKeys: ['changelog_r_2_8_4_d1', 'changelog_r_2_8_4_d2'],
  },
  {
    version: '2.8.3',
    isoDate: '2026-09-12',
    titleKey: 'changelog_r_2_8_3_t',
    highlightKeys: ['changelog_r_2_8_3_h1', 'changelog_r_2_8_3_h2'],
    detailKeys: ['changelog_r_2_8_3_d1', 'changelog_r_2_8_3_d2'],
  },
  {
    version: '2.8.2',
    isoDate: '2026-09-12',
    titleKey: 'changelog_r_2_8_2_t',
    highlightKeys: ['changelog_r_2_8_2_h1'],
    detailKeys: ['changelog_r_2_8_2_d1'],
  },
  {
    version: '2.8.1',
    isoDate: '2026-09-11',
    titleKey: 'changelog_r_2_8_1_t',
    highlightKeys: ['changelog_r_2_8_1_h1', 'changelog_r_2_8_1_h2'],
    detailKeys: ['changelog_r_2_8_1_d1'],
  },
  {
    version: '2.8.0',
    isoDate: '2026-09-11',
    titleKey: 'changelog_r_2_8_0_t',
    highlightKeys: ['changelog_r_2_8_0_h1', 'changelog_r_2_8_0_h2', 'changelog_r_2_8_0_h3'],
    detailKeys: ['changelog_r_2_8_0_d1', 'changelog_r_2_8_0_d2'],
  },
  {
    version: '2.7.0',
    isoDate: '2026-09-11',
    titleKey: 'changelog_r_2_7_0_t',
    highlightKeys: ['changelog_r_2_7_0_h1', 'changelog_r_2_7_0_h2', 'changelog_r_2_7_0_h3', 'changelog_r_2_7_0_h4', 'changelog_r_2_7_0_h5'],
    detailKeys: ['changelog_r_2_7_0_d1', 'changelog_r_2_7_0_d2', 'changelog_r_2_7_0_d3', 'changelog_r_2_7_0_d4', 'changelog_r_2_7_0_d5'],
  },
  {
    version: '2.6.1',
    isoDate: '2026-09-10',
    titleKey: 'changelog_r_2_6_1_t',
    highlightKeys: ['changelog_r_2_6_1_h1', 'changelog_r_2_6_1_h2', 'changelog_r_2_6_1_h3', 'changelog_r_2_6_1_h4'],
    detailKeys: ['changelog_r_2_6_1_d1', 'changelog_r_2_6_1_d2', 'changelog_r_2_6_1_d3', 'changelog_r_2_6_1_d4'],
  },
  {
    version: '2.6.0',
    isoDate: '2026-09-10',
    titleKey: 'changelog_r_2_6_0_t',
    highlightKeys: ['changelog_r_2_6_0_h1', 'changelog_r_2_6_0_h2', 'changelog_r_2_6_0_h3', 'changelog_r_2_6_0_h4', 'changelog_r_2_6_0_h5'],
    detailKeys: ['changelog_r_2_6_0_d1', 'changelog_r_2_6_0_d2', 'changelog_r_2_6_0_d3', 'changelog_r_2_6_0_d4', 'changelog_r_2_6_0_d5', 'changelog_r_2_6_0_d6'],
  },
  {
    version: '2.5.1',
    isoDate: '2026-09-06',
    titleKey: 'changelog_r_2_5_1_t',
    highlightKeys: ['changelog_r_2_5_1_h1', 'changelog_r_2_5_1_h2', 'changelog_r_2_5_1_h3'],
    detailKeys: ['changelog_r_2_5_1_d1', 'changelog_r_2_5_1_d2', 'changelog_r_2_5_1_d3'],
  },
  {
    version: '2.5.0',
    isoDate: '2026-09-06',
    titleKey: 'changelog_r_2_5_0_t',
    highlightKeys: ['changelog_r_2_5_0_h1', 'changelog_r_2_5_0_h2', 'changelog_r_2_5_0_h3'],
    detailKeys: ['changelog_r_2_5_0_d1', 'changelog_r_2_5_0_d2', 'changelog_r_2_5_0_d3'],
  },
  {
    version: '2.4.2',
    isoDate: '2026-09-05',
    titleKey: 'changelog_r_2_4_2_t',
    highlightKeys: ['changelog_r_2_4_2_h1', 'changelog_r_2_4_2_h2', 'changelog_r_2_4_2_h3'],
    detailKeys: ['changelog_r_2_4_2_d1', 'changelog_r_2_4_2_d2', 'changelog_r_2_4_2_d3'],
  },
  {
    version: '2.4.1',
    isoDate: '2026-09-03',
    titleKey: 'changelog_r_2_4_1_t',
    highlightKeys: ['changelog_r_2_4_1_h1', 'changelog_r_2_4_1_h2', 'changelog_r_2_4_1_h3'],
    detailKeys: ['changelog_r_2_4_1_d1', 'changelog_r_2_4_1_d2', 'changelog_r_2_4_1_d3'],
  },
  {
    version: '2.4.0',
    isoDate: '2026-09-03',
    titleKey: 'changelog_r_2_4_0_t',
    highlightKeys: ['changelog_r_2_4_0_h1', 'changelog_r_2_4_0_h2', 'changelog_r_2_4_0_h3'],
    detailKeys: ['changelog_r_2_4_0_d1', 'changelog_r_2_4_0_d2', 'changelog_r_2_4_0_d3'],
  },
  {
    version: '2.3.1',
    isoDate: '2026-09-02',
    titleKey: 'changelog_r_2_3_1_t',
    highlightKeys: ['changelog_r_2_3_1_h1', 'changelog_r_2_3_1_h2', 'changelog_r_2_3_1_h3'],
    detailKeys: ['changelog_r_2_3_1_d1', 'changelog_r_2_3_1_d2', 'changelog_r_2_3_1_d3'],
  },
  {
    version: '2.3.0',
    isoDate: '2026-09-02',
    titleKey: 'changelog_r_2_3_0_t',
    highlightKeys: ['changelog_r_2_3_0_h1', 'changelog_r_2_3_0_h2'],
    detailKeys: ['changelog_r_2_3_0_d1', 'changelog_r_2_3_0_d2'],
  },
  {
    version: '2.2.2',
    isoDate: '2026-09-02',
    titleKey: 'changelog_r_2_2_2_t',
    highlightKeys: ['changelog_r_2_2_2_h1'],
    detailKeys: ['changelog_r_2_2_2_d1'],
  },
  {
    version: '2.2.1',
    isoDate: '2026-09-02',
    titleKey: 'changelog_r_2_2_1_t',
    highlightKeys: ['changelog_r_2_2_1_h1'],
    detailKeys: ['changelog_r_2_2_1_d1'],
  },
  {
    version: '2.2.0',
    isoDate: '2026-09-02',
    titleKey: 'changelog_r_2_2_0_t',
    highlightKeys: ['changelog_r_2_2_0_h1'],
    detailKeys: ['changelog_r_2_2_0_d1'],
  },
  {
    version: '2.1.0',
    isoDate: '2026-09-02',
    titleKey: 'changelog_r_2_1_0_t',
    highlightKeys: ['changelog_r_2_1_0_h1'],
    detailKeys: ['changelog_r_2_1_0_d1'],
  },
  {
    version: '2.0.0',
    isoDate: '2026-09-01',
    titleKey: 'changelog_r_2_0_0_t',
    highlightKeys: ['changelog_r_2_0_0_h1'],
    detailKeys: ['changelog_r_2_0_0_d1'],
  },
  {
    version: '1.9.5',
    isoDate: '2026-08-31',
    titleKey: 'changelog_r_1_9_5_t',
    highlightKeys: ['changelog_r_1_9_5_h1'],
    detailKeys: ['changelog_r_1_9_5_d1'],
  },
  {
    version: '1.9.0',
    isoDate: '2026-08-31',
    titleKey: 'changelog_r_1_9_0_t',
    highlightKeys: ['changelog_r_1_9_0_h1'],
    detailKeys: ['changelog_r_1_9_0_d1'],
  },
  {
    version: '1.8.0',
    isoDate: '2026-08-31',
    titleKey: 'changelog_r_1_8_0_t',
    highlightKeys: ['changelog_r_1_8_0_h1'],
    detailKeys: ['changelog_r_1_8_0_d1'],
  },
  {
    version: '1.7.0',
    isoDate: '2026-08-30',
    titleKey: 'changelog_r_1_7_0_t',
    highlightKeys: ['changelog_r_1_7_0_h1'],
    detailKeys: ['changelog_r_1_7_0_d1'],
  },
  {
    version: '1.6.0',
    isoDate: '2026-08-30',
    titleKey: 'changelog_r_1_6_0_t',
    highlightKeys: ['changelog_r_1_6_0_h1'],
    detailKeys: ['changelog_r_1_6_0_d1'],
  },
  {
    version: '1.5.0',
    isoDate: '2026-08-30',
    titleKey: 'changelog_r_1_5_0_t',
    highlightKeys: ['changelog_r_1_5_0_h1'],
    detailKeys: ['changelog_r_1_5_0_d1'],
  },
  {
    version: '1.4.0',
    isoDate: '2026-08-29',
    titleKey: 'changelog_r_1_4_0_t',
    highlightKeys: ['changelog_r_1_4_0_h1'],
    detailKeys: ['changelog_r_1_4_0_d1'],
  },
  {
    version: '1.3.0',
    isoDate: '2026-08-29',
    titleKey: 'changelog_r_1_3_0_t',
    highlightKeys: ['changelog_r_1_3_0_h1'],
    detailKeys: ['changelog_r_1_3_0_d1'],
  },
  {
    version: '1.2.0',
    isoDate: '2026-08-28',
    titleKey: 'changelog_r_1_2_0_t',
    highlightKeys: ['changelog_r_1_2_0_h1'],
    detailKeys: ['changelog_r_1_2_0_d1'],
  },
  {
    version: '1.1.0',
    isoDate: '2026-08-28',
    titleKey: 'changelog_r_1_1_0_t',
    highlightKeys: ['changelog_r_1_1_0_h1'],
    detailKeys: ['changelog_r_1_1_0_d1'],
  },
  {
    version: '1.0.0',
    isoDate: '2026-08-27',
    titleKey: 'changelog_r_1_0_0_t',
    highlightKeys: ['changelog_r_1_0_0_h1'],
    detailKeys: ['changelog_r_1_0_0_d1'],
  },
];

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  const [selectedVersion, setSelectedVersion] = useState<string>(CURRENT_VERSION);
  const { t, formatDate } = useT();

  if (!isOpen) return null;

  const currentRelease = RELEASES.find((r) => r.version === selectedVersion) || RELEASES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--bg-raised)] text-[var(--text-primary)] w-full max-w-4xl h-[85vh] rounded-3xl border border-[var(--border-default)] flex flex-col md:flex-row overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
        
        {/* Left Column: Version History Sidebar */}
        <div className="w-full md:w-64 border-r border-[var(--border-default)] bg-[var(--bg-subtle)] flex flex-col h-1/3 md:h-full shrink-0">
          <div className="p-5 border-b border-[var(--border-default)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('changelog_sidebar_title')}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {RELEASES.map((rel) => (
              <button
                key={rel.version}
                onClick={() => setSelectedVersion(rel.version)}
                className={`w-full text-left px-4 py-3 rounded-2xl transition-all cursor-pointer flex flex-col gap-0.5 ${
                  selectedVersion === rel.version
                    ? 'bg-[var(--bg-surface)] border border-[var(--accent-border)] shadow-xs'
                    : 'hover:bg-[var(--bg-hover)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${
                    selectedVersion === rel.version ? 'text-[var(--accent-text)]' : 'text-[var(--text-primary)]'
                  }`}>
                    v{rel.version}
                  </span>
                  {rel.badgeKey && (
                    <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[8px] font-bold">
                      {t(rel.badgeKey)}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-[var(--text-muted)] truncate font-medium">
                  {t(rel.titleKey)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Version Details Section */}
        <div className="flex-1 flex flex-col h-2/3 md:h-full min-w-0 bg-[var(--bg-surface)]">
          
          {/* Header */}
          <div className="p-6 border-b border-[var(--border-default)] flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono bg-[var(--bg-subtle)] px-2 py-0.5 rounded border border-[var(--border-default)] text-[var(--text-muted)]">
                  v{currentRelease.version}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] font-semibold">
                  {t('changelog_released_on', { date: formatDate(currentRelease.isoDate) })}
                </span>
              </div>
              <h2 className="text-lg font-extrabold text-[var(--text-primary)] mt-1">
                {t(currentRelease.titleKey)}
              </h2>
            </div>

            <button
              onClick={onClose}
              aria-label={t('close')}
              className="p-2 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] hover:border-[var(--accent-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Details Scroll Area */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
            
            {/* Highlights Box */}
            <div className="p-5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-default)] space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--accent-text)] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('changelog_whats_new')}</span>
              </h4>
              <ul className="space-y-2">
                {currentRelease.highlightKeys.map((hKey, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-[var(--text-primary)]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="font-semibold">{t(hKey)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Detailed Changes list */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t('changelog_changes_heading')}
              </h4>
              <div className="space-y-2.5">
                {currentRelease.detailKeys.map((dKey, i) => (
                  <div
                    key={i}
                    className="p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl flex items-start gap-3"
                  >
                    <Zap className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0 mt-0.5" />
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {t(dKey)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Footer actions */}
          <div className="p-6 border-t border-[var(--border-default)] bg-[var(--bg-surface)] flex items-center justify-between shrink-0">
            <span className="text-[10px] text-[var(--text-muted)]">
              {t('changelog_footer_brand', { version: CURRENT_VERSION })}
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
            >
              <span>{t('changelog_continue')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
