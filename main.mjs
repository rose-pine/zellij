#!/usr/bin/env node

// built-in node: modules
import console from 'node:console';
import fs from 'node:fs';
import fsPromise from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// thrid-party modules
import { program } from 'commander';
import inquirer from 'inquirer';
import _ from 'chalk';
import fetch from 'node-fetch';

function ok(message) {
	console.log(` [  ${_.green('OK')}  ] `, message);
}
function fail(message) {
	console.log(` [ ${_.red('FAIL')} ] `, message);
}
function sublog(message, deps = 1) {
	return console.log('          '.concat(' '.repeat(2 * deps)), message);
}
function info(message) {
	console.log(` [ ${_.blueBright('INFO')} ] `, message);
}

const $HOME = process.env['HOME'];
const ZELLIJ_CONFIG_DIR = path.join($HOME, '.config', 'zellij');
const ZELLIJ_CONFIG_FILE = path.join(ZELLIJ_CONFIG_DIR, 'config.kdl');
const ZELLIJ_CONFIG_THEMES_DIR = path.join(ZELLIJ_CONFIG_DIR, 'themes');
const ZELLIJ_THEMES = {
	'rose-pine': {
		filename: 'rose-pine.kdl',
		gh_url: 'https://raw.githubusercontent.com/rose-pine/zellij/main/dist/rose-pine.kdl',
	},
	'rose-pine-moon': {
		filename: 'rose-pine-moon.kdl',
		gh_url: 'https://raw.githubusercontent.com/rose-pine/zellij/main/dist/rose-pine-moon.kdl',
	},
	'rose-pine-dawn': {
		filename: 'rose-pine-dawn.kdl',
		gh_url: 'https://raw.githubusercontent.com/rose-pine/zellij/main/dist/rose-pine-dawn.kdl',
	},
};

async function main(args) {
	const d_zellij_path = ZELLIJ_CONFIG_THEMES_DIR.replace($HOME, '~');

	info('try to find themes directory in '.concat(_.yellow(d_zellij_path)));
	if (fs.existsSync(ZELLIJ_CONFIG_THEMES_DIR) === false) {
		fail(`cannot find themes directory in ${_.yellow(d_zellij_path)}`);
		const answers = await inquirer.prompt([
			{
				name: 'should_create_zellij_config_dir',
				default: true,
				type: 'confirm',
				message: 'are accept to create '.concat(d_zellij_path),
			},
		]);

		if (answers['should_create_zellij_config_dir'] === false) {
			fail(`${_.yellow('zellij')} directory not exists`);
			return 1;
		}
		const res = fs.mkdirSync(ZELLIJ_CONFIG_THEMES_DIR, { recursive: true });
		ok(`created themes directory in ${_.yellow(d_zellij_path)}`);
		sublog(_.grey(res));
	} else {
		ok(`${_.bold.yellow('zellij')} config directory exists`);
	}

	info('try to find variants');
	await Promise.all(
		Object.keys(ZELLIJ_THEMES).map(async function (variant_name) {
			const variant_obj = ZELLIJ_THEMES[variant_name];
			const filename = variant_obj.filename;
			const variant_file_path = path.join(
				ZELLIJ_CONFIG_THEMES_DIR,
				filename,
			);

			if (fs.existsSync(variant_file_path) === true) {
				info(`found ${_.yellow(variant_name)}`);
				return 0;
			} else {
				fail(`not found ${_.yellow(variant_name)}`);
			}

			info(`try to download ${_.yellow(variant_name)}`);
			const variant_content = await gh_content_of(variant_obj.gh_url);
			await fsPromise.writeFile(
				variant_file_path,
				variant_content,
				'utf-8',
			);
			ok(`download successful ${_.yellow(variant_name)}`);
		}),
	);

	let variant = args.variant;
	if (variant === 'notselected') {
		const answers = await inquirer.prompt([
			{
				name: 'selected_variant',
				message: 'which variant type do you like?',
				type: 'list',
				choices: Object.keys(ZELLIJ_THEMES).map(
					(variant_name, index) => ({
						type: 'choice',
						checked: index === 0,
						name: variant_name,
						value: variant_name,
					}),
				),
			},
		]);
		variant = answers['selected_variant'];
	}

	if (fs.existsSync(ZELLIJ_CONFIG_FILE) === false) {
		await fsPromise.writeFile(
			ZELLIJ_CONFIG_FILE,
			`theme "${variant}"`,
			'utf-8',
		);
	} else {
		const raw_config_content = await fsPromise.readFile(
			ZELLIJ_CONFIG_FILE,
			'utf-8',
		);
		const new_config_content = raw_config_content
			.split('\n')
			.filter((line) => line.startsWith('theme') === false)
			.concat(`theme "${variant}"`)
			.join('\n');
		await fsPromise.writeFile(
			ZELLIJ_CONFIG_FILE,
			new_config_content,
			'utf-8',
		);
	}

	ok('your variant configured successfully: '.concat(_.bold.yellow(variant)));
	return 0;
}

async function gh_content_of(gh_url) {
	return fetch(gh_url).then((res) => res.text());
}

function get_version() {
	const packagejson = get_packagejson();
	return packagejson['version'] || 'undetected';
}

function get_name() {
	const packagejson = get_packagejson();
	return packagejson['name'];
}

function get_description() {
	const packagejson = get_packagejson();
	return packagejson['description'];
}

function get_packagejson() {
	let dirname = '.';

	if (typeof globalThis['__dirname'] !== 'undefined') {
		dirname = __dirname;
	}

	if (typeof import.meta['dirname'] !== 'undefined') {
		dirname = import.meta.dirname;
	}

	if (typeof path.dirname(fileURLToPath(import.meta.url)) !== 'undefined') {
		dirname = path.dirname(fileURLToPath(import.meta.url));
	}

	const packagejson_path = path.resolve(dirname, 'package.json');
	const packagejson_raw_content = fs.readFileSync(packagejson_path, 'utf-8');
	const packagejson_parsed = JSON.parse(packagejson_raw_content);
	return packagejson_parsed;
}

(async (argv) => {
	program
		.name(get_name())
		.description(get_description())
		.version(get_version(), '--version', '-v')
		.usage('[OPTIONS]')
		.option('-t, --variant <value>', 'select <variant> type', 'notselected')
		.parse(argv);

	const args = program.opts();

	main(args)
		.then(function postprocess(exitCode) {
			return process.exit(exitCode);
		})
		.catch(function exception(error) {
			console.error(error);
		});
})(process.argv);
