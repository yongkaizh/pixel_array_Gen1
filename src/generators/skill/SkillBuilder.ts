export class SkillBuilder {
  private code: string[] = [];

  push(...lines: string[]) {
    this.code.push(...lines);
  }

  build(): string {
    return this.code.join("\n");
  }
}
