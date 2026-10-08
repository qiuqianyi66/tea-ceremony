package com.tea.architecture;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.domain.JavaField;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.domain.JavaAnnotation;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

/**
 * 架构约束机械化（Harness 285「约束必须自动化」落地）。
 * 依据：.harness/rules/编码规范.md 红线 #1（分层单向依赖 / Controller 禁查库 / 构造器注入）。
 * 错误信息三要素：❌ 什么问题 / ✅ FIX 怎么修 / 📖 See 去哪看文档 —— 让 Agent 读到报错即自修复。
 * 纯编程式（不用 @AnalyzeClasses/@ArchTest）：surefire 必须真实执行规则，禁静默跳过。
 */
public class LayerDependencyTest {

    /** 红线 #1：Controller 不得直接查询数据库（依赖 Repository 层视为违规）。 */
    public static final ArchRule controllerMustNotUseRepository = noClasses()
        .that().resideInAPackage("..controller..")
        .should().dependOnClassesThat().resideInAPackage("..repository..")
        .because("❌ 违反红线 #1：Controller 直接依赖 Repository。\n"
            + "✅ FIX: 数据访问下沉到 Service，Controller 仅注入 Service 并调用其方法。\n"
            + "📖 See: .harness/rules/编码规范.md §1（分层与依赖方向）");

    /** 红线 #1：Service 不得依赖 Controller。 */
    public static final ArchRule serviceMustNotDependOnController = noClasses()
        .that().resideInAPackage("..service..")
        .should().dependOnClassesThat().resideInAPackage("..controller..")
        .because("❌ 违反红线 #1：Service 反向依赖 Controller。\n"
            + "✅ FIX: 依赖方向必须单向 Controller → Service → Repository。\n"
            + "📖 See: .harness/rules/编码规范.md §1（分层与依赖方向）");

    /** 红线 #1：Repository 不得依赖上层（Service / Controller）。 */
    public static final ArchRule repositoryMustNotDependOnUpperLayers = noClasses()
        .that().resideInAPackage("..repository..")
        .should().dependOnClassesThat().resideInAPackage("..service..")
        .orShould().dependOnClassesThat().resideInAPackage("..controller..")
        .because("❌ 违反红线 #1：Repository 依赖上层。\n"
            + "✅ FIX: Repository 只依赖 entity / 数据访问基础设施，不依赖业务层。\n"
            + "📖 See: .harness/rules/编码规范.md §1（分层与依赖方向）");

    /** 强规范（🟢）：禁字段级 @Autowired，必须构造器注入（final 字段 + @RequiredArgsConstructor）。 */
    public static final ArchRule noFieldInjection = noClasses()
        .should(new ArchCondition<>("不出现字段级 @Autowired 注入") {
            @Override
            public void check(JavaClass clazz, ConditionEvents events) {
                for (JavaField field : clazz.getFields()) {
                    if (field.isAnnotatedWith(org.springframework.beans.factory.annotation.Autowired.class)
                            && !field.getModifiers().contains(com.tngtech.archunit.core.domain.JavaModifier.FINAL)) {
                        events.add(SimpleConditionEvent.violated(field,
                            "❌ 违反强规范：字段级 @Autowired 注入于 "
                                + clazz.getName() + "#" + field.getName() + "。\n"
                                + "✅ FIX: 改为 final 字段 + Lombok @RequiredArgsConstructor 构造器注入。\n"
                                + "📖 See: .harness/rules/编码规范.md §1（构造器注入）"));
                    }
                }
            }
        });

    /**
     * 编码规范 §7 + ADR-014：service 写方法 @Transactional 必须带 rollbackFor；只读必须 readOnly=true。
     * 基线 2026-10-08：6 处写方法缺 rollbackFor（已修复 c562252），readOnly 9 处全部合规。
     */
    public static final ArchRule transactionalWriteMethodsNeedRollbackFor = methods()
        .that().areDeclaredInClassesThat().resideInAPackage("..service..")
        .and().areAnnotatedWith(Transactional.class)
        .should(new ArchCondition<>("写方法声明 rollbackFor / 只读声明 readOnly=true") {
            @Override
            public void check(JavaMethod method, ConditionEvents events) {
                JavaAnnotation annotation = method.getAnnotationOfType(Transactional.class.getName());
                if (Boolean.TRUE.equals(annotation.get("readOnly"))) {
                    events.add(SimpleConditionEvent.satisfied(method, "只读方法 readOnly=true"));
                } else if (annotation.get("rollbackFor") == null) {
                    events.add(SimpleConditionEvent.violated(method,
                        "❌ 写方法 @Transactional 缺 rollbackFor 属性。\n"
                        + "✅ FIX: 改为 @Transactional(rollbackFor = Exception.class)。\n"
                        + "📖 See: .harness/rules/编码规范.md §7（事务）+ ADR-014"));
                }
            }
        });

    /**
     * 编码规范 §7 + ADR-014：controller 方法统一返回 ApiResponse<T>（错误由全局异常处理器兜底）。
     * 基线 2026-10-08：6 个 controller 14 个方法全部 ApiResponse，0 违规。
     * getRawReturnType 取原始类型（getReturnType().getName() 会含泛型参数）。
     */
    public static final ArchRule controllersReturnApiResponse = methods()
        .that().areDeclaredInClassesThat().resideInAPackage("..controller..")
        .and().arePublic()
        .should(new ArchCondition<>("返回 ApiResponse<?>") {
            @Override
            public void check(JavaMethod method, ConditionEvents events) {
                if (!method.getRawReturnType().getName().equals("com.tea.common.response.ApiResponse")) {
                    events.add(SimpleConditionEvent.violated(method,
                        "❌ Controller 方法返回 " + method.getReturnType().getName() + "，非 ApiResponse。\n"
                        + "✅ FIX: 返回 ApiResponse<T>（成功 ApiResponse.ok(...)，错误由全局异常处理器兜底）。\n"
                        + "📖 See: .harness/rules/编码规范.md §7（响应契约）+ ADR-014"));
                }
            }
        });

    /**
     * Surefire 执行入口：编程式运行全部规则（唯一执行路径，禁被 ArchUnit 引擎静默跳过）。
     */
    @Test
    public void architectureRulesHold() {
        JavaClasses classes = new ClassFileImporter()
            .withImportOption(new ImportOption.DoNotIncludeTests())
            .importPackages("com.tea");
        controllerMustNotUseRepository.check(classes);
        serviceMustNotDependOnController.check(classes);
        repositoryMustNotDependOnUpperLayers.check(classes);
        noFieldInjection.check(classes);
        transactionalWriteMethodsNeedRollbackFor.check(classes);
        controllersReturnApiResponse.check(classes);
    }
}
