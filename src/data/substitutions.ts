// ─────────────────────────────────────────────────────────────────────────────
//  Official substitutes — Man City vs Newcastle United, Feb 21 2026
//  Source: official lineup sheet
//  NOTE: Substitution logic (replacing on-pitch player with sub when CRE
//        delivers a substitution event) is planned for a future update.
// ─────────────────────────────────────────────────────────────────────────────

import type { Player } from "../types";

export const CITY_SUBS: Player[] = [
  {
    id: "city_sub_gk",
    name: "Trafford Carl",
    team: "home",
    number: 18,
    position: "GK",
    odds: 80.0,
  },
  {
    id: "city_sub_1",
    name: "Cherki Rayan",
    team: "home",
    number: 10,
    position: "CAM",
    odds: 3.2,
  },
  {
    id: "city_sub_2",
    name: "Foden Phil",
    team: "home",
    number: 47,
    position: "CAM",
    odds: 2.8,
  },
  {
    id: "city_sub_3",
    name: "Chusanov Abduqodir",
    team: "home",
    number: 34,
    position: "CB",
    odds: 18.0,
  },
  {
    id: "city_sub_4",
    name: "Lewis Rico",
    team: "home",
    number: 82,
    position: "RB",
    odds: 15.0,
  },
  {
    id: "city_sub_5",
    name: "Reijnders Tijjani",
    team: "home",
    number: 8,
    position: "CM",
    odds: 4.5,
  },
  {
    id: "city_sub_6",
    name: "Savinho",
    team: "home",
    number: 26,
    position: "RW",
    odds: 5.0,
  },
  {
    id: "city_sub_7",
    name: "Stones John",
    team: "home",
    number: 5,
    position: "CB",
    odds: 14.0,
  },
  {
    id: "city_sub_8",
    name: "González Nico",
    team: "home",
    number: 11,
    position: "LW",
    odds: 6.5,
  },
];

export const NEWCASTLE_SUBS: Player[] = [
  {
    id: "newc_sub_gk1",
    name: "Ramsdale Aaron",
    team: "away",
    number: 12,
    position: "GK",
    odds: 80.0,
  },
  {
    id: "newc_sub_gk2",
    name: "Ruddy John",
    team: "away",
    number: 23,
    position: "GK",
    odds: 80.0,
  },
  {
    id: "newc_sub_1",
    name: "Barnes Harvey",
    team: "away",
    number: 15,
    position: "LW",
    odds: 4.5,
  },
  {
    id: "newc_sub_2",
    name: "Murphy Alex",
    team: "away",
    number: 26,
    position: "CM",
    odds: 12.0,
  },
  {
    id: "newc_sub_3",
    name: "Joelinton",
    team: "away",
    number: 7,
    position: "CM",
    odds: 8.0,
  },
  {
    id: "newc_sub_4",
    name: "Murphy Jacob",
    team: "away",
    number: 23,
    position: "RW",
    odds: 6.0,
  },
  {
    id: "newc_sub_5",
    name: "Neave Trevan",
    team: "away",
    number: 39,
    position: "CM",
    odds: 20.0,
  },
  {
    id: "newc_sub_6",
    name: "Osula William",
    team: "away",
    number: 30,
    position: "ST",
    odds: 9.0,
  },
  {
    id: "newc_sub_7",
    name: "Shahar Daniel",
    team: "away",
    number: 35,
    position: "RB",
    odds: 25.0,
  },
];
