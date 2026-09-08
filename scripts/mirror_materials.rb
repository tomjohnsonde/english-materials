#!/usr/bin/env ruby
# Mirrors public uploaded resources listed in a JSON file into the static site.

require 'fileutils'
require 'json'
require 'net/http'
require 'set'
require 'uri'

input_path = ARGV.fetch(0)
project_root = File.expand_path('..', __dir__)
materials_dir = File.join(project_root, 'assets', 'materials')
manifest_path = File.join(materials_dir, 'manifest.json')
data_path = File.join(project_root, 'assets', 'data.js')

resources = JSON.parse(File.read(input_path))
FileUtils.mkdir_p(materials_dir)

def safe_filename(source)
  uri = URI(source)
  raw_name = URI.decode_www_form_component(File.basename(uri.path))
  extension = File.extname(raw_name).downcase
  stem = File.basename(raw_name, extension)
  clean_stem = stem.encode('UTF-8', invalid: :replace, undef: :replace, replace: '_')
                   .downcase
                   .gsub(/[^a-z0-9]+/, '-')
                   .gsub(/\A-+|-+\z/, '')
                   .sub(/\A0-/, '')
                   .gsub(/part(i{1,3}|iv|v)\z/, 'part-\\1')
  clean_stem = 'original-material' if clean_stem.empty? || clean_stem.match?(/\A[a-f0-9]{10,}\z/)
  "#{clean_stem}#{extension}"
end

def unique_filename(filename, used_names)
  extension = File.extname(filename)
  stem = File.basename(filename, extension)
  candidate = filename
  suffix = 2
  while used_names.include?(candidate.downcase)
    candidate = "#{stem}-#{suffix}#{extension}"
    suffix += 1
  end
  used_names << candidate.downcase
  candidate
end

def download(uri, destination, redirects = 0)
  raise "too many redirects" if redirects > 5

  request_uri = uri.request_uri.empty? ? '/' : uri.request_uri
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = uri.scheme == 'https'
  http.open_timeout = 30
  http.read_timeout = 180
  request = Net::HTTP::Get.new(request_uri, { 'User-Agent' => 'Mozilla/5.0 (compatible; MaterialsMirror/1.0)' })

  http.request(request) do |response|
    if response.is_a?(Net::HTTPRedirection)
      return download(URI.join(uri, response['location']), destination, redirects + 1)
    end
    raise "HTTP #{response.code}" unless response.is_a?(Net::HTTPSuccess)

    temporary = "#{destination}.part"
    File.open(temporary, 'wb') { |file| response.read_body { |chunk| file.write(chunk) } }
    File.rename(temporary, destination)
    return [File.size(destination), response['content-type']]
  end
end

manifest = []
failures = []
used_names = Set.new
resources.each_with_index do |resource, index|
  local_name = unique_filename(safe_filename(resource.fetch('source')), used_names)
  destination = File.join(materials_dir, local_name)
  local_path = "assets/materials/#{local_name}"

  begin
    if File.file?(destination) && File.size(destination).positive?
      bytes = File.size(destination)
      content_type = nil
      status = 'already present'
    else
      bytes, content_type = download(URI(resource.fetch('source')), destination)
      status = 'downloaded'
    end
    manifest << resource.merge('local' => local_path, 'bytes' => bytes, 'content_type' => content_type)
    puts format('[%3d/%3d] %s: %s', index + 1, resources.length, status, local_name)
  rescue StandardError => error
    FileUtils.rm_f("#{destination}.part")
    failures << { 'source' => resource['source'], 'error' => error.message }
    warn format('[%3d/%3d] failed: %s (%s)', index + 1, resources.length, resource['source'], error.message)
  end
end

File.write(manifest_path, JSON.pretty_generate(manifest))
updated_data = File.read(data_path)
manifest.each { |resource| updated_data = updated_data.gsub(resource.fetch('source'), resource.fetch('local')) }
File.write(data_path, updated_data)

if failures.empty?
  puts "\nCompleted: #{manifest.length} files saved in assets/materials."
  puts "Manifest: #{manifest_path}"
else
  File.write(File.join(materials_dir, 'failed-downloads.json'), JSON.pretty_generate(failures))
  abort "\nCompleted with #{failures.length} failed download. The available files and local links were saved."
end
