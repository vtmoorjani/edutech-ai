import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link,
} from "@react-pdf/renderer";
import type { ProfileInputT, RoadmapResultT } from "@/lib/schemas";
import type { Course } from "@/lib/data";

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: "Helvetica", fontSize: 10, color: "#18181b" },
  h1: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  h2: { fontSize: 13, fontWeight: 700, marginTop: 18, marginBottom: 6 },
  h3: { fontSize: 11, fontWeight: 700, marginTop: 0, marginBottom: 2 },
  meta: { fontSize: 9, color: "#52525b", marginBottom: 14 },
  phase: {
    border: "1pt solid #e4e4e7",
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
  },
  phaseHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  phaseLabel: { fontSize: 8, color: "#71717a", textTransform: "uppercase" },
  phaseName: { fontSize: 13, fontWeight: 700 },
  phaseFocus: { fontSize: 10, color: "#3f3f46", marginBottom: 8 },
  course: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderTop: "0.5pt solid #f4f4f5",
  },
  courseTitle: { fontSize: 10, fontWeight: 700 },
  courseMeta: { fontSize: 8, color: "#71717a" },
  twoCol: { flexDirection: "row", gap: 12, marginTop: 8 },
  col: { flex: 1 },
  label: { fontSize: 8, color: "#71717a", textTransform: "uppercase" },
  body: { fontSize: 10, color: "#27272a" },
  callout: {
    backgroundColor: "#fafafa",
    border: "1pt solid #e4e4e7",
    borderRadius: 6,
    padding: 10,
    marginTop: 10,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 8,
    color: "#a1a1aa",
    textAlign: "center",
  },
});

export function RoadmapDocument({
  profile,
  roadmap,
  courses,
}: {
  profile: ProfileInputT;
  roadmap: RoadmapResultT;
  courses: Course[];
}) {
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const totalWeeks = roadmap.phases.reduce((s, p) => s + p.weeks, 0);
  const totalCost = courses.reduce((s, c) => s + c.price_usd, 0);

  return (
    <Document
      title={`SkillPath roadmap — ${profile.target_role}`}
      author="SkillPath AI"
    >
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.h1}>{profile.target_role} learning roadmap</Text>
        <Text style={styles.meta}>
          {profile.current_role} · {profile.years_experience}y experience ·{" "}
          {totalWeeks} weeks · ${totalCost} total · {profile.weekly_hours}h/week
        </Text>

        <Text style={styles.h2}>Phased plan</Text>
        {roadmap.phases.map((p, idx) => {
          const phaseCourses = p.course_ids
            .map((id) => courseById.get(id))
            .filter((c): c is Course => c != null);
          const phaseHours = phaseCourses.reduce(
            (s, c) => s + c.duration_hours,
            0,
          );
          return (
            <View key={idx} style={styles.phase} wrap={false}>
              <View style={styles.phaseHead}>
                <View>
                  <Text style={styles.phaseLabel}>Phase {p.phase}</Text>
                  <Text style={styles.phaseName}>{p.name}</Text>
                </View>
                <View>
                  <Text style={styles.phaseLabel}>Duration</Text>
                  <Text style={styles.phaseName}>
                    {p.weeks}w · {phaseHours}h
                  </Text>
                </View>
              </View>
              <Text style={styles.phaseFocus}>{p.focus}</Text>
              {phaseCourses.map((c) => (
                <View key={c.id} style={styles.course}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Link
                      src={c.url}
                      style={[styles.courseTitle, { color: "#18181b" }]}
                    >
                      {c.title}
                    </Link>
                    <Text style={styles.courseMeta}>
                      {c.platform} · {c.duration_hours}h · ${c.price_usd} ·{" "}
                      {c.format}
                    </Text>
                  </View>
                </View>
              ))}
              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Text style={styles.label}>Objective</Text>
                  <Text style={styles.body}>{p.objective}</Text>
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>Output</Text>
                  <Text style={styles.body}>{p.output_artifact}</Text>
                </View>
              </View>
            </View>
          );
        })}

        {roadmap.portfolio_project && (
          <View style={styles.callout}>
            <Text style={styles.h3}>Capstone project</Text>
            <Text style={styles.body}>{roadmap.portfolio_project}</Text>
          </View>
        )}
        {roadmap.linkedin_update_suggestion && (
          <View style={styles.callout}>
            <Text style={styles.h3}>LinkedIn update</Text>
            <Text style={styles.body}>{roadmap.linkedin_update_suggestion}</Text>
          </View>
        )}

        <Text style={styles.footer} fixed>
          Generated by SkillPath AI · AI-generated recommendations · Verify
          course details on the provider's site before purchasing.
        </Text>
      </Page>
    </Document>
  );
}
