# data-model Specification

## Purpose

Prisma schema requirements for InstagramFollower analytics fields and database-native type annotations.

## Requirements

### Requirement: InstagramFollower Analytics Fields

InstagramFollower MUST include `unfollowedAt` (DateTime?, nullable) and `followCount` (Int, @default(0)).

### Requirement: DB-Native Type Annotations

All Prisma schema String columns MUST specify `@db.VarChar(N)` with appropriate max length. All DateTime columns MUST specify `@db.Timestamptz`.
